"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteChat } from "@/app/actions/chat";
import { useTransition } from "react";

export default function ChatSidebarItem({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isActive = pathname === `/chats/${chatId}`;

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); // Link ke andar hai, navigate hone se roko
    e.stopPropagation();

    const confirmed = confirm("Delete this chat? This cannot be undone.");
    if (!confirmed) return;

    startTransition(async () => {
      await deleteChat(chatId);

      // Agar yehi chat abhi khuli thi, list page pe wapas bhej do
      if (isActive) {
        router.push("/chats");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div
      className={`group flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-200 ${
        isActive ? "bg-gray-200" : ""
      }`}
    >
      <Link
        href={`/chats/${chatId}`}
        className="flex-1 text-sm truncate"
      >
        {title}
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 ml-2 shrink-0"
        title="Delete chat"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}