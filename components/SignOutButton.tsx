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
      className="rounded-lg border border-border/80 bg-card/80 px-3.5 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-xl transition-colors hover:border-primary/30 hover:bg-secondary hover:text-foreground disabled:opacity-50"
      aria-label="Sign out"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
