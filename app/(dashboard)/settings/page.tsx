"use client";

import { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UpgradeButton } from "@/components/UpgradeButton";

type UsageData = {
  stats: { currentPlan: string };
};

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [plan, setPlan] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.fullName ?? "");
    }
  }, [user]);

  useEffect(() => {
    fetch("/api/usage")
      .then((res) => res.json())
      .then((data: UsageData) => setPlan(data.stats.currentPlan))
      .catch(() => setPlan(null));
  }, []);

  async function handleSaveName() {
    if (!user) return;
    setSavingName(true);
    try {
      const [firstName, ...rest] = name.trim().split(" ");
      await user.update({ firstName, lastName: rest.join(" ") || undefined });
    } catch (err) {
      console.error(err);
      alert("Couldn't update your name. Try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    const confirmed = window.confirm(
      "This permanently deletes your account and all your documents and chats. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      await user.delete();
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Couldn't delete your account. Try again or contact support.");
      setDeleting(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="animate-pulse h-40 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-serif">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide">Appearance</h2>
        <div className="flex items-center justify-between border rounded-lg p-4">
          <div>
            <p className="font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide">Profile</h2>
        <div className="border rounded-lg p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Name</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Email</label>
            <p className="text-sm text-muted-foreground">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm text-muted-foreground uppercase tracking-wide">Billing</h2>
        <div className="border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Current plan</p>
            <p className="text-sm text-muted-foreground">{plan ?? "Loading..."}</p>
          </div>
          {plan === "FREE" ? (
            <UpgradeButton />
          ) : plan === "PRO" ? (
            <a
              href="mailto:support@documind-ai.com?subject=Cancel%20subscription"
              className="text-sm text-muted-foreground underline"
            >
              Contact support to cancel
            </a>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm text-destructive uppercase tracking-wide">Danger Zone</h2>
        <div className="border border-destructive/30 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Delete account</p>
            <p className="text-sm text-muted-foreground">
              Permanently deletes your account, documents, and chat history.
            </p>
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="rounded-md bg-destructive text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="text-sm text-muted-foreground underline"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
