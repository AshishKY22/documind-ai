
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default function ChatsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
      <h2 className="text-xl font-semibold mb-2">No chat selected</h2>
      <p className="text-gray-500 mb-6 max-w-sm">
        Pick a chat from the sidebar, or go to a document and start a new one.
      </p>
      <Link
        href="/documents"
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
      >
        Go to Documents
      </Link>
    </div>
  );
}