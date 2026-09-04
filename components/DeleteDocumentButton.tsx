"use client";

import { Trash2 } from "lucide-react";
import { deleteDocument } from "@/app/actions/document";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); // stop the parent Link from navigating
    e.stopPropagation();

    const confirmed = confirm("Delete this document? This cannot be undone.");
    if (!confirmed) return;

    startTransition(async () => {
      await deleteDocument(documentId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
      title="Delete document"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}