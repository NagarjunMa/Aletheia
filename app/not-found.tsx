import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-md animate-fade-in text-center">
        <div className="mb-4">
          <p className="text-6xl font-bold text-[hsl(var(--primary))]">404</p>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-block rounded-lg bg-[hsl(var(--primary))] px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-hidden focus:ring-2 focus:ring-[hsl(var(--ring))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--background))] transition-all"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
