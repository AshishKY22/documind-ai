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
| PDF parsing | [`unpdf`](https://github.com/unjs/unpdf) (serverless-safe, no native/canvas dependency) |
| File uploads | UploadThing |
| Payments | Razorpay (subscriptions + webhooks) |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Deployment | Vercel |

## Architecture Notes

**Retrieval-augmented chat.** Each user message is embedded and matched against a Pinecone namespace scoped to that document, returning the top-K most relevant chunks as context for the model. The model is instructed to answer only from that context.

**Cross-session memory.** Every message (user and assistant) is *also* embedded into a second, per-user Pinecone namespace (`{userId}-memory`), independent of any single document. When a new question comes in, the app searches this memory namespace in addition to the document-scoped search, filtering out low-similarity matches and excluding the current chat (since its own history is already included separately). This lets the assistant recall relevant facts from entirely different chats and documents, without those unrelated documents polluting normal single-document retrieval.

**Payments.** Razorpay subscription events (`activated`, `charged`, `cancelled`, etc.) are received via a signed webhook, verified with HMAC-SHA256, and used to keep each user's `Subscription` record in sync. The webhook maps Razorpay's `notes.clerkUserId` back to the app's internal user ID before writing to the database. The client never unlocks Pro access directly on payment success — it waits for the webhook, which is the source of truth.

**User sync.** Clerk is the identity provider, but the app keeps its own `User` table (for relations to documents, chats, and subscriptions). A Clerk webhook (`user.created` / `user.updated` / `user.deleted`) keeps that table in sync. Without this webhook correctly configured in production, signed-in users exist in Clerk but not in the app's database, and every authenticated request fails with "User not found."

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
NEXT_PUBLIC_APP_URL=
GEMINI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=
UPLOADTHING_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

> **`NEXT_PUBLIC_APP_URL`** is required, not optional — see [Deployment Notes](#deployment-notes--known-gotchas) below for why.

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

Remember to update these to your production URL after deploying — see below.

## Deployment

Deployed on Vercel, connected directly to this GitHub repository — pushes to `main` trigger an automatic redeploy. Environment variables are configured in the Vercel project settings.

### Deployment Notes / Known Gotchas

This app needs a few production-only setup steps beyond copying `.env` values into Vercel. Skipping any of these will produce errors that don't show up in local development at all, which makes them easy to miss.

**1. Clerk requires a domain proxy on `*.vercel.app` domains.**
Vercel owns the `vercel.app` domain, so there's no DNS record you can add to verify it with Clerk the normal way. Instead, Clerk proxies its script through a path on your own app (`/__clerk/*`). This requires:
- `"/__clerk/:path*"` present in the `matcher` array in `middleware.ts`
- Clicking **"Verify proxy"** in Clerk's dashboard (Configure → Domains → your domain) after deploying

If this isn't set up, sign-in/sign-up will fail with a `ClerkRuntimeError` / `failed_to_load_clerk_js` in the browser console, and requests to `/__clerk/...` will 404.

**2. Set `NEXT_PUBLIC_APP_URL` in production.**
Server-side code (e.g. `app/actions/document.ts`) makes internal fetch calls to other API routes on this same app, and falls back to `http://localhost:3000` if this variable isn't set. That fallback works fine locally but silently breaks on Vercel (`ECONNREFUSED 127.0.0.1:3000`), leaving uploaded documents stuck on `PENDING` forever with no visible error in the UI. Set it to your real deployed URL, e.g.:
```
NEXT_PUBLIC_APP_URL=https://documind-ai-henna.vercel.app
```

**3. Configure the Clerk webhook in production — this does not carry over from local dev.**
An `ngrok` webhook URL used during local development will not work in production, and this endpoint has to be created fresh in Clerk's dashboard even if you already had one earlier:
- Clerk dashboard → Configure → Webhooks → Add Endpoint
- URL: `https://<your-domain>/api/webhooks/clerk`
- Subscribe to: `user.created`, `user.updated`, `user.deleted`
- Copy the generated signing secret into `CLERK_WEBHOOK_SECRET` in Vercel

Without this, Clerk and your database disagree about who your users are — sign-in works, but every authenticated request (uploading a document, sending a chat message) fails with `"User not found"`.

**4. Google/GitHub sign-in need real OAuth credentials, not just enabling the toggle.**
Turning on Google or GitHub as a sign-in method in Clerk isn't enough by itself for a live production app — you need to create real OAuth credentials (e.g. in Google Cloud Console) and add the Client ID/Secret under Clerk's SSO connection settings, with Clerk's exact callback URL (`/__clerk/v1/oauth_callback`) registered as an authorized redirect URI on the provider's side. Skipping this produces a `Missing required parameter: client_id` error from the provider itself, not from your app.

**5. PDF text extraction uses `unpdf`, not `pdf-parse`/`pdfjs-dist`, for a reason.**
`pdf-parse` depends on `pdfjs-dist`, which optionally uses a native canvas binary (`@napi-rs/canvas`) for certain rendering paths. That binary does not reliably build or load in Vercel's serverless (Linux) runtime — even after installing it explicitly and marking it as an external server package — and fails with errors like `Cannot find module '@napi-rs/canvas'` and `ReferenceError: DOMMatrix is not defined`. `unpdf` was built specifically for serverless/edge runtimes and has no such dependency. If you ever swap PDF libraries again, confirm it works in an actual Vercel deployment, not just locally.

**6. After deploying, update Clerk's and Razorpay's webhook URLs from any local tunnel to your production domain**, if you haven't already — see the local development section above.

### Post-Deploy Checklist

- [ ] Clerk → Domains shows the production domain as **Verified**, not "Unverified" or "Pending"
- [ ] `middleware.ts` matcher includes `"/__clerk/:path*"`
- [ ] Clerk → Webhooks → Endpoints has exactly one production endpoint at `/api/webhooks/clerk`, subscribed to `user.created` / `user.updated` / `user.deleted`, with recent deliveries returning `200`
- [ ] Sign up with a brand-new account and confirm a row appears in the `User` table
- [ ] Upload a small PDF and confirm its status moves `PENDING` → `PROCESSING` → `READY`
- [ ] If Google/GitHub sign-in buttons are shown, confirm real OAuth credentials are configured (not just the default toggle)
- [ ] `NEXT_PUBLIC_APP_URL` is set in Vercel and matches the real deployed domain

## Known Limitations

- Gemini's free-tier API key is capped at 20 requests/day — heavy testing or real usage will need a billing-enabled Gemini project
- Deleting a chat or document does not currently clean up its corresponding vectors in Pinecone (both the document-chunk and cross-session-memory namespaces), which can leave orphaned data over time

---

Built as a portfolio project to explore RAG pipelines, vector search, and full-stack Next.js.
