"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { UTApi } from "uploadthing/server";
import { pineconeIndex } from "@/lib/pinecone";
import { revalidatePath } from "next/cache";

const utapi = new UTApi();

export async function createDocument(data: {
  name: string;
  url: string;
  key: string;
  size: number;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });
  if (!user) throw new Error("User not found");

  const document = await prisma.document.create({
    data: {
      name: data.name,
      url: data.url,
      key: data.key,
      size: data.size,
      status: "PENDING",
      userId: user.id,
    },
  });

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/process-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({ documentId: document.id }),
  }).catch(console.error);

  return document;
}

export async function deleteDocument(documentId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) throw new Error("User not found");

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== dbUser.id) {
    throw new Error("Forbidden");
  }

  // 1. Delete vectors from Pinecone (best-effort — don't block on failure)
  try {
    await pineconeIndex.namespace(userId).deleteMany({
      filter: { documentId },
    });
  } catch (err) {
    console.error("Pinecone delete failed:", err);
  }

  // 2. Delete file from UploadThing (best-effort)
  try {
    await utapi.deleteFiles(document.key);
  } catch (err) {
    console.error("UploadThing delete failed:", err);
  }

  // 3. Delete DB row (cascades to Messages via schema)
  await prisma.document.delete({ where: { id: documentId } });

  revalidatePath("/documents");
}