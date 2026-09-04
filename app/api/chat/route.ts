// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pineconeIndex } from "@/lib/pinecone";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI } from "@google/genai";

const SOURCES_DELIMITER = "\n\n<<<SOURCES>>>\n\n";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const TOP_K = 5;
const HISTORY_LIMIT = 6; // last 6 messages (3 turns) for conversational context

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
    await prisma.message.create({
      data: {
        chatId,
        documentId,
        role: "USER",
        content: message,
      },
    });

    // 4. Embed the question
    const embedResult = await genai.models.embedContent({
      model: "gemini-embedding-001",
      contents: message,
    });

    if (!embedResult.embeddings || embedResult.embeddings.length === 0) {
      throw new Error("Failed to embed question");
    }

    const queryVector = embedResult.embeddings[0].values;

if (!queryVector) {
  throw new Error("Failed to get embedding values for question");
}

    // 5. Query Pinecone, scoped to this document
    const searchResults = await pineconeIndex.namespace(userId).query({
      vector: queryVector,
      topK: TOP_K,
      filter: { documentId },
      includeMetadata: true,
    });

    const matches = searchResults.matches ?? [];

    // Build context string + keep source metadata for saving later
    const contextChunks = matches.map((m) => ({
      text: (m.metadata?.text as string) ?? "",
      chunkIndex: m.metadata?.chunkIndex,
      score: m.score,
    }));

    const contextText = contextChunks
      .map((c, i) => `[Chunk ${i + 1}]\n${c.text}`)
      .join("\n\n");

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
${contextText}`;

    const contents = [
      ...historyContents,
      { role: "user", parts: [{ text: message }] },
    ];

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

          for await (const chunk of streamResult) {
            const text = chunk.text ?? "";
            fullResponse += text;
            controller.enqueue(new TextEncoder().encode(text));
            }

            // Send sources as a trailing, delimited chunk (not part of fullResponse)
            controller.enqueue(
            new TextEncoder().encode(SOURCES_DELIMITER + JSON.stringify(contextChunks))
            );


                    // 9. Save the assistant's full message once streaming is done
          await prisma.message.create({
            data: {
              chatId,
              documentId,
              role: "ASSISTANT",
              content: fullResponse,
              sources: contextChunks,
            },
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
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}