import { Pinecone } from "@pinecone-database/pinecone";

const globalForPinecone = globalThis as unknown as {
  pinecone: Pinecone | undefined;
};

export const pinecone = globalForPinecone.pinecone ?? new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

if (process.env.NODE_ENV !== "production") {
  globalForPinecone.pinecone = pinecone;
}

export const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX!);