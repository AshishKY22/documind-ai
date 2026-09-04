
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import ChatWindow from "@/components/ChatWindow";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ chatId: string }>;
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { chatId } = await params;
  const { documentId: documentIdFromQuery } = await searchParams;

  const { userId } = await auth();
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId! } });

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!chat || chat.userId !== dbUser?.id) {
    notFound();
  }

  // Fallback: agar URL mein documentId nahi hai, pehle message se le lo
  const documentId =
    documentIdFromQuery ?? chat.messages[0]?.documentId ?? null;

  if (!documentId) {
    notFound(); // koi document hi nahi pata, kuch galat hai
  }

  return (
    <ChatWindow
      chatId={chat.id}
      documentId={documentId}
      initialMessages={chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: (m.sources as any) ?? undefined,
        }))}
    />
  );
}