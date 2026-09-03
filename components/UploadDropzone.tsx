"use client";

import { UploadDropzone } from "@uploadthing/react";
import { OurFileRouter } from "@/app/api/uploadthing/core";
import { useState, useEffect } from "react";
import { createDocument } from "@/app/actions/document";

export default function DocumentUpload() {
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "ready" | "error">("idle");
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Poll for document status
  useEffect(() => {
    if (!documentId || uploadStatus === "ready" || uploadStatus === "error") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/document-status?id=${documentId}`);
        const data = await res.json();
        
        if (data.status === "READY") {
          setUploadStatus("ready");
          clearInterval(interval);
        } else if (data.status === "FAILED") {
          setUploadStatus("error");
          clearInterval(interval);
        } else if (data.status === "PROCESSING") {
          setUploadStatus("processing");
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [documentId, uploadStatus]);

  return (
    <div className="w-full max-w-xl mx-auto p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition-colors">
      <UploadDropzone<OurFileRouter, "pdfUploader">
        endpoint="pdfUploader"
        onClientUploadComplete={async (res) => {
          if (!res || res.length === 0) return;
          const file = res[0];
          setUploadStatus("processing");
          
          try {
            const doc = await createDocument({
              name: file.name,
              url: file.ufsUrl,
              key: file.key,
              size: file.size,
            });
            setDocumentId(doc.id);
          } catch (error) {
            console.error("Failed to save document:", error);
            setUploadStatus("error");
          }
        }}
        onUploadError={(error: Error) => {
          console.error("Upload error:", error);
          setUploadStatus("error");
        }}
        onUploadBegin={() => {
          setUploadStatus("uploading");
        }}
      />
      
      {uploadStatus === "uploading" && (
        <p className="mt-4 text-center text-blue-600">Uploading to CDN...</p>
      )}
      {uploadStatus === "processing" && (
        <p className="mt-4 text-center text-yellow-600">Processing PDF... extracting text and creating embeddings</p>
      )}
      {uploadStatus === "ready" && (
        <p className="mt-4 text-center text-green-600">Ready! You can now chat with this document.</p>
      )}
      {uploadStatus === "error" && (
        <p className="mt-4 text-center text-red-600">Something went wrong. Try again.</p>
      )}
    </div>
  );
}