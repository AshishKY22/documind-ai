"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

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