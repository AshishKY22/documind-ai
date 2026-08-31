"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function createDocument(data: {
  name: string;
  url: string;
  key: string;
  size: number;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Find the user in our database using clerkId
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    throw new Error("User not found in database");
  }

  // Create the document record
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

  return document;
}