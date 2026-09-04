
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pineconeIndex } from "@/lib/pinecone";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

// Without these, Next.js can treat this route as cacheable/static in some
// cases, which causes the whole stream to be buffered and sent as one chunk
// instead of progressively — exactly the "answer appears all at once" bug.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCES_DELIMITER = "\n\n<<<SOURCES>>>\n\n";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TOP_K = 5;
const HISTORY_LIMIT = 6; // last 6 messages (3 turns) for conversational context

// --- Cross-session memory settings ---
const MEMORY_TOP_K = 4;
const MEMORY_SCORE_THRESHOLD = 0.5; // Gemini embeddings score lower than OpenAI's typically do

async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const result = await genai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: firstMessage }] }],
      config: {
        systemInstruction:
          "Generate a very short title (max 6 words) summarizing this question. Reply with ONLY the title text — no quotes, no punctuation at the end, no explanation.",
      },
    });

    const title = result.text?.trim();
    if (title && title.length > 0) {
      return title.slice(0, 60);
    }
  } catch (err) {
    console.error("Title generation failed, falling back:", err);
  }

  // Fallback if AI title generation fails for any reason
  return firstMessage.slice(0, 60);
}

// Embeds arbitrary text using the same model used for document chunks/questions.
async function embedText(text: string): Promise<number[]> {
  const result = await genai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  const values = result.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Failed to get embedding values");
  }
  return values;
}

// Upserts a single message into the cross-session memory namespace.
// Fire-and-forget from the caller's perspective is NOT used here — we await it,
// but we don't let a memory-write failure break the actual chat response.
async function upsertMemory(params: {
  userId: string;
  messageId: string;
  chatId: string;
  documentId: string;
  role: "USER" | "ASSISTANT";
  text: string;
  vector?: number[];
}) {
  try {
    const vector = params.vector ?? (await embedText(params.text));
    await pineconeIndex.namespace(`${params.userId}-memory`).upsert({
      records: [
        {
          id: params.messageId,
          values: vector,
          metadata: {
            chatId: params.chatId,
            documentId: params.documentId,
            role: params.role,
            text: params.text,
            createdAt: Date.now(),
          },
        },
      ],
    });
  } catch (err) {
    // Memory is an enhancement, not core functionality — never fail the chat over this.
    console.error("Failed to upsert memory:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { documentId, message, chatId: existingChatId } = body;

    if (!documentId || !message) {
      return NextResponse.json(
        { error: "documentId and message are required" },
        { status: 400 }
      );
    }

    // 1. Verify document belongs to this user and is ready
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { user: true },
    });

    if (!document || document.user.clerkId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (document.status !== "READY") {
      return NextResponse.json(
        { error: "Document is not ready for chat yet" },
        { status: 400 }
      );
    }

    // 2. Get or create the Chat
    const dbUser = document.user;
    let chatId = existingChatId;

    if (!chatId) {
      const title = await generateChatTitle(message);

      const newChat = await prisma.chat.create({
        data: {
          userId: dbUser.id,
          title,
        },
      });
      chatId = newChat.id;
    }

    // 3. Save the user's message
    const userMessage = await prisma.message.create({
      data: {
        chatId,
        documentId,
        role: "USER",
        content: message,
      },
    });

    // 4. Embed the question (reused for document search, memory search, AND memory upsert below)
    const queryVector = await embedText(message);

    // 5. Query Pinecone, scoped to this document (unchanged from before)
    const searchResults = await pineconeIndex.namespace(userId).query({
      vector: queryVector,
      topK: TOP_K,
      filter: { documentId },
      includeMetadata: true,
    });

    const matches = searchResults.matches ?? [];

    const contextChunks = matches.map((m) => ({
      text: (m.metadata?.text as string) ?? "",
      chunkIndex: m.metadata?.chunkIndex,
      score: m.score,
    }));

    const contextText = contextChunks
      .map((c, i) => `[Chunk ${i + 1}]\n${c.text}`)
      .join("\n\n");

    // 5b. Query cross-session memory — past messages from OTHER chats (any document),
    // so the assistant can recall things discussed in previous sessions.
    let memoryContextText = "";
    try {
      const memoryResults = await pineconeIndex
        .namespace(`${userId}-memory`)
        .query({
          vector: queryVector,
          topK: MEMORY_TOP_K,
          filter: { chatId: { $ne: chatId } },
          includeMetadata: true,
        });

      const memoryMatches = (memoryResults.matches ?? []).filter(
        (m) => (m.score ?? 0) >= MEMORY_SCORE_THRESHOLD
      );

      // TEMPORARY DEBUG: remove once threshold is confirmed working
      console.log(
        "Memory search scores:",
        (memoryResults.matches ?? []).map((m) => m.score)
      );

      if (memoryMatches.length > 0) {
        memoryContextText = memoryMatches
          .map((m) => `- (${m.metadata?.role}) ${m.metadata?.text}`)
          .join("\n");
      }
    } catch (err) {
      // Memory namespace may not exist yet for brand-new users — that's fine, just skip it.
      console.error("Memory search failed (non-fatal):", err);
    }

    // 6. Get recent chat history (excluding the message we just saved)
    const recentMessages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT + 1, // +1 because it includes the message we just added
      skip: 1,
    });
    const history = recentMessages.reverse(); // chronological order

    // 7. Build the prompt contents for Gemini
    const historyContents = history.map((m) => ({
      role: m.role === "USER" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const systemInstruction = `You are answering questions about a specific document. 
Use ONLY the context provided below to answer. If the answer is not contained in the context, 
say clearly that the document doesn't seem to cover that, rather than guessing.

Context from the document:
${contextText}
${
  memoryContextText
    ? `\nRelevant information from the user's past conversations (other sessions/documents). Use this only as background — prioritize the document context above when answering questions about this document:\n${memoryContextText}`
    : ""
}`;

    const contents = [
      ...historyContents,
      { role: "user", parts: [{ text: message }] },
    ];

    // Save the user's message into cross-session memory (reusing the vector we already computed)
    await upsertMemory({
      userId,
      messageId: userMessage.id,
      chatId,
      documentId,
      role: "USER",
      text: message,
      vector: queryVector,
    });

    // 8. Stream the response
    const streamResult = await genai.models.generateContentStream({
      model: "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction,
      },
    });

    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResult) {
            const text = chunk.text ?? "";
            fullResponse += text;
            controller.enqueue(new TextEncoder().encode(text));
          }

          // Send sources as a trailing, delimited chunk (not part of fullResponse)
          controller.enqueue(
            new TextEncoder().encode(
              SOURCES_DELIMITER + JSON.stringify(contextChunks)
            )
          );

          // 9. Save the assistant's full message once streaming is done
          const assistantMessage = await prisma.message.create({
            data: {
              chatId,
              documentId,
              role: "ASSISTANT",
              content: fullResponse,
              sources: contextChunks,
            },
          });

          // Save the assistant's reply into cross-session memory too (new embed call —
          // we don't have a vector for this text yet since it didn't exist until now).
          await upsertMemory({
            userId,
            messageId: assistantMessage.id,
            chatId,
            documentId,
            role: "ASSISTANT",
            text: fullResponse,
          });

          controller.close();
        } catch (err) {
          console.error("Streaming error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Id": chatId, // so the frontend knows the chatId for a new chat
        "X-Accel-Buffering": "no", // prevent reverse proxies from buffering the stream
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}