"use client";

import { UploadDropzone } from "@uploadthing/react";
import { OurFileRouter } from "@/app/api/uploadthing/core";
import { useState } from "react";
import { createDocument } from "@/app/actions/document";

export default function DocumentUpload() {
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  return (
    <div className="w-full max-w-xl mx-auto p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 transition-colors">
      <UploadDropzone<OurFileRouter, "pdfUploader">
        endpoint="pdfUploader"
        onClientUploadComplete={async (res) => {
          if (!res || res.length === 0) return;
          
          const file = res[0];
          setUploadStatus("success");
          
          // Save to database
          try {
            await createDocument({
              name: file.name,
              url: file.ufsUrl,
              key: file.key,
              size: file.size,
            });
            console.log("Document saved to database");
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
        <p className="mt-4 text-center text-blue-600">Uploading...</p>
      )}
      {uploadStatus === "success" && (
        <p className="mt-4 text-center text-green-600">Upload complete! Saved to database.</p>
      )}
      {uploadStatus === "error" && (
        <p className="mt-4 text-center text-red-600">Something went wrong. Try again.</p>
      )}
    </div>
  );
}