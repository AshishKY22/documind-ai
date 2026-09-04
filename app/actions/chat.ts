
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function startNewChat(documentId: string) {
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

  const chat = await prisma.chat.create({
    data: {
      userId: dbUser.id,
      title: document.name, // e.g. "Q1.pdf" — good default title
    },
  });

  redirect(`/chats/${chat.id}?documentId=${documentId}`);
}

export async function deleteChat(chatId: string) {
  "use server";

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!dbUser) throw new Error("User not found");

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.userId !== dbUser.id) {
    throw new Error("Forbidden");
  }

  await prisma.chat.delete({ where: { id: chatId } });

  revalidatePath("/chats"); // sidebar ko fresh data ke saath re-render karne ke liye
}