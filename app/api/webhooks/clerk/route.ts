import { prisma } from "@/lib/prisma";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  const payload = await req.json();
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", { status: 400 });
  }

  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(JSON.stringify(payload), {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    return new Response("Error: Verification failed", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    const primaryEmail = email_addresses?.[0]?.email_address;

    if (!primaryEmail) {
      return new Response("Error: No email address found on user", { status: 400 });
    }

    await prisma.user.create({
      data: {
        clerkId: id,
        email: primaryEmail,
        name: `${first_name || ""} ${last_name || ""}`.trim() || null,
      },
    });
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;

    await prisma.user.deleteMany({
      where: { clerkId: id },
    });
  }

  return new Response("Webhook received", { status: 200 });
}