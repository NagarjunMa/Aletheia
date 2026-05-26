"use client";

import { useTransition } from "react";
import { signOutAction } from "@/app/auth/actions";

export default function SignOutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => signOutAction())}
      disabled={pending}
      className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[hsl(var(--secondary))] disabled:opacity-50"
      aria-label="Sign out"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
