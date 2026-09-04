import ChatWindow from "@/components/ChatWindow";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { documentId } = await searchParams;
  if (!documentId) notFound();

  const { userId } = await auth();
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId! } });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== dbUser?.id) {
    notFound();
  }

  return <ChatWindow chatId={null} documentId={documentId} initialMessages={[]} />;
}