import { requireRefundAdmin } from "@/lib/auth/refund-admin";
import { refundQuerySchema } from "@/modules/refund-review/domain/refund-review";
import { listRefundCases } from "@/modules/refund-review/infrastructure/refund-review.repository";
import {
  adminJson,
  adminError,
} from "@/modules/refund-review/application/refund-admin-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireRefundAdmin();
    const query = refundQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return adminJson(await listRefundCases(query));
  } catch (error) {
    return adminError(error);
  }
}
