"use client";

import { useEffect, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CreditPack = {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
};

type LedgerRow = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  category: string | null;
  created_at: string;
};

type CreditSummary = {
  billingMode?: "credits" | "unlimited_developer";
  unlimitedCredits?: boolean;
  balance: number | null;
  lifetimeCreditsPurchased: number;
  lifetimeCreditsUsed: number;
  creditExpiry: null;
  packs: CreditPack[];
  ledger: LedgerRow[];
};

export default function CreditsPanel({ className }: { className?: string }) {
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadCredits() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch("/api/billing/credits", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error("Unable to load credits");
        }
        const data = (await res.json()) as CreditSummary;
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load credits",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadCredits();

    return () => {
      cancelled = true;
    };
  }, []);

  const packs = summary?.packs ?? [
    { id: "starter", name: "Starter", credits: 60, priceUsd: 5 },
    { id: "plus", name: "Plus", credits: 100, priceUsd: 7 },
    { id: "pro", name: "Pro", credits: 500, priceUsd: 20 },
  ];

  return (
    <Card
      className={cn(
        "flex flex-col p-5 transition-[border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card sm:p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden={true} />
            ) : (
              <Coins className="h-4 w-4" aria-hidden={true} />
            )}
          </span>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Credit balance
          </p>
        </div>
        <Badge variant="outline">No expiry</Badge>
      </div>

      <div className="mt-7">
        <p className="text-5xl font-semibold leading-none tracking-[-0.04em] text-foreground">
          {isLoading
            ? "—"
            : summary?.unlimitedCredits
              ? "Unlimited"
              : (summary?.balance ?? 0).toLocaleString()}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {summary?.unlimitedCredits
            ? "Developer access is active. Daily safeguards still apply."
            : "Connections use 2 credits; email and InMail drafts use 4."}
        </p>
        {error && (
          <p className="mt-3 text-sm font-semibold text-rose-200">{error}</p>
        )}
      </div>

      <div className="mt-auto pt-7">
        <p className="mb-3 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Credit packs
        </p>
        <div className="grid grid-cols-3 gap-2">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="rounded-lg border border-border/60 bg-background/30 p-3"
            >
              <p className="text-xs text-muted-foreground">{pack.name}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                ${pack.priceUsd}
                <span className="ml-1 font-normal text-muted-foreground">
                  · {pack.credits}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
