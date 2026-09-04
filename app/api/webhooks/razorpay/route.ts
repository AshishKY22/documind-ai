import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // adjust to your actual Prisma client import path

export async function POST(req: NextRequest) {
  // Read the RAW body — signature verification needs the exact bytes,
  // not a parsed/re-stringified version. Same "streams can only be read once" lesson from Week 4.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify this request genuinely came from Razorpay, not an attacker
  // pretending to send us a fake "payment succeeded" event.
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");



  if (expectedSignature !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event;
  const subscriptionEntity = event.payload?.subscription?.entity;
  const clerkUserId = subscriptionEntity?.notes?.clerkUserId;

  if (!clerkUserId) {
    // Nothing we can match to a user — acknowledge so Razorpay doesn't retry forever,
    // but log it since it shouldn't normally happen.
    console.error("Webhook missing clerkUserId in notes", eventType);
    return NextResponse.json({ received: true });
  }

  // The webhook gives us the Clerk user ID, but our Subscription.userId
  // foreign key points at the internal User.id (cuid), not the Clerk ID.
  // Look up the internal user first so every write below uses the right ID.
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
  });

  if (!user) {
    console.error("Webhook: no user found for clerkId", clerkUserId);
    return NextResponse.json({ received: true });
  }

  switch (eventType) {
    case "subscription.authenticated":
    case "subscription.activated":
      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          status: "ACTIVE",
          razorpaySubscriptionId: subscriptionEntity.id,
          tier: "PRO",
        },
        create: {
          userId: user.id,
          status: "ACTIVE",
          razorpaySubscriptionId: subscriptionEntity.id,
          tier: "PRO",
        },
      });
      break;

    case "subscription.charged":
      // Recurring renewal succeeded — just confirm status stays active.
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { status: "ACTIVE" },
      });
      break;

    case "subscription.cancelled":
    case "subscription.completed":
      await prisma.subscription.update({
        where: { userId: user.id },
        data: { status: "CANCELED", tier: "FREE" },
      });
      break;

    default:
      // Unhandled event type — fine to ignore, just don't error.
      break;
  }

  // Always return 200 once you've processed it successfully —
  // Razorpay retries with backoff if it doesn't get a 200.
  return NextResponse.json({ received: true });
}