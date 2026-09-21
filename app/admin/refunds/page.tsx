import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRefundAdmin, RefundAdminError } from "@/lib/auth/refund-admin";
import ShaderBackground from "@/components/ShaderBackground";
import RefundReviewPanel from "./RefundReviewPanel";
export const dynamic = "force-dynamic";
export default async function RefundReviewPage() {
  try {
    await requireRefundAdmin();
  } catch (error) {
    if (error instanceof RefundAdminError && error.status === 401)
      redirect("/auth/login");
    return (
      <main className="p-8">
        <h1>Refund review unavailable</h1>
        <p>
          Administrator access is required. Check your account or contact the
          operator.
        </p>
        <Link href="/dashboard">Return to dashboard</Link>
      </main>
    );
  }
  return (
    <div className="product-shell min-h-screen">
      <ShaderBackground />
      <main className="relative mx-auto max-w-6xl p-6">
        <Link href="/dashboard" className="text-accent">
          Back to dashboard
        </Link>
        <h1 className="mt-6 text-3xl">Generation credit review</h1>
        <p className="my-4 text-muted-foreground">
          Automatic restorations need no action. Review unresolved cases;
          credits are restored only once against the original charge.
        </p>
        <Link href="/admin/refunds/receipts" className="text-accent">
          Weekly credit receipts
        </Link>
        <RefundReviewPanel />
      </main>
    </div>
  );
}
