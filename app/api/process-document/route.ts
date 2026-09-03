import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pineconeIndex } from "@/lib/pinecone";
import { auth } from "@clerk/nextjs/server";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Recursive text splitter
function splitTextIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    start += chunkSize - overlap;
  }

  return chunks;
}

export async function POST(req: NextRequest) {
  let documentId: string | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    documentId = body.documentId;

    // 1. Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId! },
      include: { user: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.user.clerkId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Update status to PROCESSING
    await prisma.document.update({
      where: { id: documentId! },
      data: { status: "PROCESSING" },
    });

    // 3. Fetch PDF from URL and parse
    const response = await fetch(document.url);
    const buffer = await response.arrayBuffer();

    const parser = new PDFParse({ data: Buffer.from(buffer) });
    const result = await parser.getText();
    const text = result.text;
    await parser.destroy();

    // 4. Split into chunks
    const chunks = splitTextIntoChunks(text, 1000, 200);

    // 5. Generate embeddings for each chunk
    // NOTE: no config.outputDimensionality here — Pinecone index "documind"
    // was recreated at dimension 3072 to match Gemini's native output.
    // If you ever change the index dimension again, this must match exactly.
    const embeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        const result = await genai.models.embedContent({
          model: "gemini-embedding-001",
          contents: chunk,
        });

        if (!result.embeddings || result.embeddings.length === 0) {
          throw new Error(`No embedding returned for chunk ${index} of document ${documentId}`);
        }

        return {
          id: `${documentId}-${index}`,
          values: result.embeddings[0].values,
          metadata: {
            text: chunk,
            documentId: documentId!,
            userId: userId,
            chunkIndex: index,
          },
        };
      })
    );

    // 6. Upsert to Pinecone (in user's namespace)
    // If your Pinecone SDK version expects a plain array rather than
    // { records: [...] }, use: await pineconeIndex.namespace(userId).upsert(embeddings);
    await pineconeIndex.namespace(userId).upsert({ records: embeddings });

    // 7. Update document status to READY
    await prisma.document.update({
      where: { id: documentId! },
      data: {
        status: "READY",
        pineconeNamespace: userId,
      },
    });

    return NextResponse.json({
      success: true,
      chunksProcessed: chunks.length,
    });
  } catch (error) {
    console.error("Processing error:", error);

    if (documentId) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED" },
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}