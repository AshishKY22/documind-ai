import UploadDropzone from "../../../components/UploadDropzone";
import { prisma } from "../../../lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { formatDistanceToNow } from "date-fns";
import { Document } from "@prisma/client";
import Link from "next/link";
import DeleteDocumentButton from "@/components/DeleteDocumentButton";

export default async function DocumentsPage() {
  const { userId } = await auth();

  let documents: Document[] = [];
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    documents = user?.documents || [];
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Documents</h1>
      <p className="mt-2 text-gray-600">Upload your PDFs, research papers, or notes.</p>

      <div className="mt-8">
        <UploadDropzone />
      </div>

      {/* Document List */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Your Documents</h2>
        {documents.length === 0 ? (
          <p className="text-gray-500">No documents yet. Upload your first PDF above.</p>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => {
              const cardContent = (
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 font-bold text-sm">
                      PDF
                    </div>
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-sm text-gray-500">
                        {(doc.size / 1024 / 1024).toFixed(2)} MB • {formatDistanceToNow(doc.createdAt)} ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      doc.status === "READY" ? "bg-green-100 text-green-700" :
                      doc.status === "PROCESSING" ? "bg-yellow-100 text-yellow-700" :
                      doc.status === "PENDING" ? "bg-gray-100 text-gray-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {doc.status}
                    </span>
                    <DeleteDocumentButton documentId={doc.id} />
                  </div>
                </div>
              );

              return doc.status === "READY" ? (
                <Link key={doc.id} href={`/documents/${doc.id}`}>
                  {cardContent}
                </Link>
              ) : (
                <div key={doc.id}>{cardContent}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}