"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { razorpay } from "@/lib/razorpay";

export async function createProSubscription() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  // Razorpay subscription — tagged with Clerk's userId via notes,
  // so the webhook can match it back to your DB user later.
  const subscription = await razorpay.subscriptions.create({
    plan_id: process.env.RAZORPAY_PLAN_ID_PRO!,
    customer_notify: 1,
    total_count: 12, // bill monthly for 12 cycles, then Razorpay stops (adjust as you like)
    notes: {
      clerkUserId: userId,
    },
  });

  return {
    subscriptionId: subscription.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    userEmail: email,
    userName: user?.fullName ?? "",
  };
}