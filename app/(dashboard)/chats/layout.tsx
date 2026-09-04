
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import ChatSidebarItem from "@/components/ChatSidebarItem";

export default async function ChatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: userId! },
  });

  const chats = dbUser
    ? await prisma.chat.findMany({
        where: { userId: dbUser.id },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            take: 1,
            select: { documentId: true },
          },
        },
      })
    : [];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-gray-50 overflow-y-auto p-3">
        <h2 className="text-sm font-semibold text-gray-500 mb-3 px-2">
          Your Chats
        </h2>
        <div className="space-y-1">
          {chats.length === 0 && (
            <p className="text-sm text-gray-400 px-2">No chats yet</p>
          )}
          {chats.map((chat) => (
            <ChatSidebarItem key={chat.id} chatId={chat.id} title={chat.title} />
          ))}
        </div>
      </aside>

      {/* Right side: whichever chat page is active */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}