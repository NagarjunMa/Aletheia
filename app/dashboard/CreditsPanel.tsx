"use client";

import { useEffect, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";

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
  balance: number;
  lifetimeCreditsPurchased: number;
  lifetimeCreditsUsed: number;
  creditExpiry: null;
  packs: CreditPack[];
  ledger: LedgerRow[];
};

export default function CreditsPanel() {
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

  return (
    <div className="rounded-lg border border-[#DAF1DE]/16 bg-[#CBEFEB]/10 p-5 shadow-[0_22px_70px_rgba(4,18,22,0.24)] backdrop-blur-2xl transition-colors hover:border-[#DAF1DE]/24 hover:bg-[#CBEFEB]/13 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DAF1DE]/14 bg-[#DAF1DE]/12 text-[#DAF1DE]">
              {isLoading ? (
                <RefreshCw
                  className="h-5 w-5 animate-spin"
                  aria-hidden={true}
                />
              ) : (
                <Coins className="h-5 w-5" aria-hidden={true} />
              )}
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#DAF1DE]/72">
              Credits
            </p>
          </div>
          <div className="mt-5">
            <p className="text-4xl font-bold leading-none text-white">
              {isLoading ? "..." : (summary?.balance ?? 0).toLocaleString()}
              <span className="ml-2 text-base font-normal text-[#CBEFEB]/62">
                available
              </span>
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#CBEFEB]/70">
              LinkedIn connections use 2 credits. Emails and InMails use 4.
              Credits do not expire; daily limits still protect the app.
            </p>
            {error && (
              <p className="mt-3 text-sm font-semibold text-rose-200">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
          {(
            summary?.packs ?? [
              { id: "starter", name: "Starter", credits: 60, priceUsd: 5 },
              { id: "plus", name: "Plus", credits: 100, priceUsd: 7 },
              { id: "pro", name: "Pro", credits: 500, priceUsd: 20 },
            ]
          ).map((pack) => (
            <div
              key={pack.id}
              className="rounded-lg border border-[#DAF1DE]/12 bg-[#06191d]/42 p-4"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-[#DAF1DE]/58">
                {pack.name}
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                ${pack.priceUsd}
              </p>
              <p className="mt-1 text-sm text-[#CBEFEB]/68">
                {pack.credits.toLocaleString()} credits
              </p>
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-lg border border-[#DAF1DE]/12 bg-[#DAF1DE]/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#DAF1DE]/55"
              >
                Checkout soon
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
