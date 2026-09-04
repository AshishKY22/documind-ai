
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import Link from "next/link";



export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;

  const { userId } = await auth();
  const dbUser = await prisma.user.findUnique({ where: { clerkId: userId! } });

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.userId !== dbUser?.id) {
    notFound();
  }


  if (document.status !== "READY") {
    return (
      <div className="p-8 text-center text-gray-500">
        This document isn&apos;t ready to chat with yet (status: {document.status}).
      </div>
    );
  }

  // Find past chats that have at least one message about this document
  const pastChats = await prisma.chat.findMany({
    where: {
      userId: dbUser.id,
      messages: { some: { documentId: document.id } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">{document.name}</h1>
      <p className="text-gray-500 mb-6">Ready to chat</p>

        <Link
        href={`/chats/new?documentId=${document.id}`}
        className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mb-8"
        >
        Start New Chat
        </Link>

      {pastChats.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">
            Past chats about this document
          </h2>
          <div className="space-y-2">
            {pastChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chats/${chat.id}?documentId=${document.id}`}
                className="block p-3 border rounded-md hover:bg-gray-50"
              >
                <div className="font-medium">{chat.title}</div>
                <div className="text-xs text-gray-400">
                  {new Date(chat.updatedAt).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}