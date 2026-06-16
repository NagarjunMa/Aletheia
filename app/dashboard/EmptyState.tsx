import Link from "next/link";

export default function EmptyState() {
  return (
    <div className="glass rounded-2xl p-8 mb-6">
      <p className="mb-2 text-[0.65rem] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        First time here
      </p>
      <h2 className="mb-4 text-xl font-semibold text-white">
        No drafts yet. Three steps to your first one.
      </h2>
      <ol className="mb-6 space-y-3 text-sm text-[hsl(var(--muted-foreground))]">
        <li>
          <span className="font-semibold text-white">1.</span> Install the
          Aletheia extension —{" "}
          <Link href="/ascendia-extension.zip" className="underline text-white">
            download the .zip
          </Link>{" "}
          and load it unpacked at chrome://extensions.
        </li>
        <li>
          <span className="font-semibold text-white">2.</span> Upload a primary
          resume in{" "}
          <Link href="/profile" className="underline text-white">
            your profile
          </Link>{" "}
          so Aletheia can ground drafts in your background.
        </li>
        <li>
          <span className="font-semibold text-white">3.</span> Open any LinkedIn
          profile and click <em>Generate</em> in the popup.
        </li>
      </ol>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/demo"
          className="flex-1 text-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm text-white transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--secondary))]"
        >
          See a sample draft first
        </Link>
        <Link
          href="/profile"
          className="flex-1 text-center rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90"
        >
          Add your resume
        </Link>
      </div>
    </div>
  );
}
