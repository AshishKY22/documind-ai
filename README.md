# DocuMind AI

Chat with your documents. Upload PDFs, DOCX, or TXT files and ask questions in natural language — DocuMind reads them, retrieves the relevant passages, and answers with cited sources. It also remembers what you've discussed across sessions, so it can connect information from one document to a conversation you had about a completely different one, weeks apart.

**Live demo:** [documind-ai-henna.vercel.app](https://documind-ai-henna.vercel.app)



## What Makes This Different

Most "chat with your documents" apps treat every conversation as an island — close the chat, and whatever you discussed is gone except as scrollback. DocuMind AI adds **cross-session memory**: every message you send, across every chat and every document, is embedded and stored in a dedicated memory index tied to your account. When you ask a new question — even in a brand-new chat, on a completely unrelated document — the assistant searches your past conversations for relevant context before answering.

Ask it something in one document, then open an entirely different document a week later and ask "what did I say my favorite topic was?" — it remembers, without you ever re-explaining yourself. It's the difference between a document Q&A tool and something that actually accumulates knowledge about you over time.



## Features

- **Document upload & processing** — PDF, DOCX, and TXT support via UploadThing, with automatic text extraction, chunking, and embedding
- **RAG-powered chat** — questions are answered using retrieval-augmented generation over your own documents, not the model's general knowledge. If the answer isn't in the document, it says so instead of guessing
- **Streaming responses** — answers appear token-by-token in real time, not all at once
- **Cited sources** — every answer links back to the specific document chunks it was generated from
- **Cross-session memory** — the assistant remembers facts from your past conversations across *all* your chats and documents, so it can answer things like "what did I say my favorite topic was?" even in a brand-new chat on an unrelated document
- **Chat history** — every conversation is saved, auto-titled, and browsable from a sidebar
- **Subscription billing** — Razorpay-powered subscriptions (Free/Pro tiers) with webhook-driven status sync
- **Usage dashboard** — document count, query count, storage used, current plan, a 30-day query trend chart, and a document-type breakdown
- **Authentication** — Clerk-powered sign-up/sign-in, with user data synced to the app's database via webhooks

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | Clerk |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Vector store | Pinecone (separate namespaces for document chunks vs. cross-session memory) |
| AI model | Google Gemini (`gemini-3.6-flash` for chat/titles, `gemini-embedding-001` for embeddings) |
| File uploads | UploadThing |
| Payments | Razorpay (subscriptions + webhooks) |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Deployment | Vercel |

## Architecture Notes

**Retrieval-augmented chat.** Each user message is embedded and matched against a Pinecone namespace scoped to that document, returning the top-K most relevant chunks as context for the model. The model is instructed to answer only from that context.

**Cross-session memory.** Every message (user and assistant) is *also* embedded into a second, per-user Pinecone namespace (`{userId}-memory`), independent of any single document. When a new question comes in, the app searches this memory namespace in addition to the document-scoped search, filtering out low-similarity matches and excluding the current chat (since its own history is already included separately). This lets the assistant recall relevant facts from entirely different chats and documents, without those unrelated documents polluting normal single-document retrieval.

**Payments.** Razorpay subscription events (`activated`, `charged`, `cancelled`, etc.) are received via a signed webhook, verified with HMAC-SHA256, and used to keep each user's `Subscription` record in sync. The webhook maps Razorpay's `notes.clerkUserId` back to the app's internal user ID before writing to the database.

## Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (e.g. [Neon](https://neon.tech))
- Accounts/API keys for: [Clerk](https://clerk.com), [Pinecone](https://pinecone.io), [Google AI Studio](https://ai.google.dev) (Gemini), [UploadThing](https://uploadthing.com), [Razorpay](https://razorpay.com)

### Setup

```bash
git clone https://github.com/AshishKY22/documind-ai.git
cd documind-ai
npm install
```

Create a `.env` file with:

```
DATABASE_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=
UPLOADTHING_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Run migrations and start the dev server:

```bash
npx prisma migrate dev
npm run dev
```

### Webhooks (local development)

Clerk and Razorpay webhooks need a publicly reachable URL to reach your local machine. Use a tunnel (e.g. `ngrok http 3000`) and point each service's webhook settings at:

```
https://<your-tunnel>.ngrok-free.app/api/webhooks/clerk
https://<your-tunnel>.ngrok-free.app/api/webhooks/razorpay
```

## Deployment

Deployed on Vercel, connected directly to this GitHub repository — pushes to `main` trigger an automatic redeploy. Environment variables are configured in the Vercel project settings. After deploying, update the Clerk and Razorpay webhook URLs to point at the production domain instead of the local tunnel.

## Known Limitations

- Gemini's free-tier API key is capped at 20 requests/day — heavy testing or real usage will need a billing-enabled Gemini project
- Deleting a chat or document does not currently clean up its corresponding vectors in Pinecone (both the document-chunk and cross-session-memory namespaces), which can leave orphaned data over time

---

Built as a portfolio project to explore RAG pipelines, vector search, and full-stack Next.js.