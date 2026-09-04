"use client";

import { useAuth, useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function AuthNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  // Don't render anything while Clerk is loading (prevents flash)
  if (!isLoaded) return null;

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/dashboard"
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium hover:border-gray-400 hover:bg-gray-50"
        >
          Dashboard
        </Link>
        <UserButton />
      </>
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button className="text-sm font-medium hover:text-gray-600">Sign In</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          Get Started
        </button>
      </SignUpButton>
    </>
  );
}