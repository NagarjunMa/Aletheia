import Link from "next/link";
import { requireRefundAdmin } from "@/lib/auth/refund-admin";
import ShaderBackground from "@/components/ShaderBackground";
import ReceiptPanel from "./ReceiptPanel";
export const dynamic = "force-dynamic";
export default async function RefundReceiptsPage() {
  try {
    await requireRefundAdmin();
  } catch {
    return (
      <main className="p-8">
        <h1>Administrator access required</h1>
        <Link href="/auth/login">Sign in</Link>
      </main>
    );
  }
  return (
    <div className="product-shell min-h-screen">
      <ShaderBackground />
      <main className="relative mx-auto max-w-5xl p-6">
        <Link href="/admin/refunds">Back to generation review</Link>
        <h1 className="my-6 text-3xl">Weekly credit receipts</h1>
        <p className="mb-4">
          Receipts summarize credits already restored. Preparing or retrying an
          email never changes credit balances. “Sent” means the provider
          accepted the email; it does not confirm inbox delivery.
        </p>
        <ReceiptPanel />
      </main>
    </div>
  );
}
