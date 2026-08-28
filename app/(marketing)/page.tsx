import { SignUpButton } from "@clerk/nextjs";
import { ArrowRight, FileText, MessageSquare, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container mx-auto flex flex-col items-center px-4 py-24 text-center">
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
          Chat with Your <span className="text-blue-600">Documents</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-gray-600">
          Upload PDFs, research papers, or notes. Our AI reads them and answers your questions with cited, contextual responses.
        </p>
        <div className="mt-10 flex gap-4">
          <SignUpButton mode="modal">
            <button className="flex items-center gap-2 rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800">
              Start for Free <ArrowRight className="h-4 w-4" />
            </button>
          </SignUpButton>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-24">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<FileText className="h-6 w-6 text-blue-600" />}
              title="Upload Any Document"
              description="Support for PDF, DOCX, and TXT files. Your documents are securely stored and processed."
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6 text-blue-600" />}
              title="AI-Powered Chat"
              description="Ask questions in natural language. Get answers sourced directly from your uploaded documents."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-blue-600" />}
              title="Private & Secure"
              description="Your documents are isolated. Other users can never access your data."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}