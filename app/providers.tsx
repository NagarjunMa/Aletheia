"use client";

import { ThemeProvider } from "next-themes";
import { PostHogProvider } from "@/lib/posthog/provider";

export function Providers({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...(nonce ? { nonce } : {})}
    >
      <PostHogProvider>{children}</PostHogProvider>
    </ThemeProvider>
  );
}
