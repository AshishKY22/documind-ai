"use client";

import { useState } from "react";
import Script from "next/script";
import { createProSubscription } from "@/app/actions/subscription";

export function UpgradeButton() {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const { subscriptionId, keyId, userEmail, userName } = await createProSubscription();

      const options = {
        key: keyId,
        subscription_id: subscriptionId,
        name: "DocuMind AI",
        description: "DocuMind Pro — Monthly",
        prefill: { email: userEmail, name: userName },
        handler: function () {
          // Payment succeeded from the browser's point of view.
          // DO NOT unlock Pro access here — wait for the webhook (source of truth).
          window.location.href = "/dashboard?upgraded=pending";
        },
        theme: { color: "#6D28D9" },
      };

      // @ts-expect-error - Razorpay is loaded globally via the script tag below
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      alert("Something went wrong starting checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="rounded-lg bg-purple-700 px-4 py-2 text-white font-medium hover:bg-purple-800 disabled:opacity-50"
      >
        {loading ? "Loading..." : "Upgrade to Pro"}
      </button>
    </>
  );
}