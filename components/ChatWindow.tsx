"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CitationCard from "@/components/CitationCard";

const SOURCES_DELIMITER = "\n\n<<<SOURCES>>>\n\n";

type Source = {
  text: string;
  chunkIndex?: number;
  score?: number;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: Source[];
};

export default function ChatWindow({
  chatId: initialChatId,
  documentId,
  initialMessages,
}: {
  chatId: string | null;
  documentId: string;
  initialMessages: Message[];
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: "USER",
      content: text,
    };
    const assistantMessageId = `temp-assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "ASSISTANT",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, documentId, message: text }),
      });

      if (!response.body) throw new Error("No response body");

      const newChatId = response.headers.get("X-Chat-Id");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let rawBuffer = "";
      let sourcesRaw = "";
      let sourcesStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        rawBuffer += chunkText;

        if (!sourcesStarted) {
          const idx = rawBuffer.indexOf(SOURCES_DELIMITER);
          if (idx !== -1) {
            sourcesStarted = true;
            const displayText = rawBuffer.slice(0, idx);
            sourcesRaw = rawBuffer.slice(idx + SOURCES_DELIMITER.length);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: displayText } : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId ? { ...m, content: rawBuffer } : m
              )
            );
          }
        } else {
          sourcesRaw += chunkText;
        }
      }

      let sources: Source[] | undefined;
      if (sourcesRaw) {
        try {
          sources = JSON.parse(sourcesRaw);
        } catch {
          sources = undefined;
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMessageId ? { ...m, sources } : m))
      );

      if (!chatId && newChatId) {
        setChatId(newChatId);
        router.replace(`/chats/${newChatId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-lg px-4 py-2 rounded-2xl ${
                m.role === "USER"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.role === "ASSISTANT" ? (
                <>
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                        code: ({ children }) => (
                          <code className="bg-gray-200 px-1 rounded text-sm">{children}</code>
                        ),
                      }}
                    >
                      {m.content || (isStreaming ? "..." : "")}
                    </ReactMarkdown>
                  </div>
                  {m.sources && <CitationCard sources={m.sources} />}
                </>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask something about this document..."
          disabled={isStreaming}
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}