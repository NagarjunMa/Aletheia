import { z } from "zod";
import { requireRefundAdmin } from "@/lib/auth/refund-admin";
import { reviewActionSchema } from "@/modules/refund-review/domain/refund-review";
import {
  getRefundCase,
  reviewRefundCase,
  executeReviewedRefund,
} from "@/modules/refund-review/infrastructure/refund-review.repository";
import {
  adminJson,
  adminError,
  requireSameOrigin,
  readReviewBody,
} from "@/modules/refund-review/application/refund-admin-http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const mutationSchema = z.union([
  reviewActionSchema.extend({ actionId: z.string().uuid() }),
  z.object({ action: z.literal("retry") }).strict(),
]);
export async function GET(_request: Request, context: Context) {
  try {
    await requireRefundAdmin();
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const detail = await getRefundCase(id);
    return detail ? adminJson(detail) : adminJson({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return adminError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const actor = await requireRefundAdmin();
    const id = z
      .string()
      .uuid()
      .parse((await context.params).id);
    const action = mutationSchema.parse(await readReviewBody(request));
    if (action.action !== "retry")
      await reviewRefundCase(
        id,
        actor,
        action.action,
        action.note,
        action.actionId,
      );
    if (action.action === "approve" || action.action === "retry") {
      try {
        return adminJson(await executeReviewedRefund(id));
      } catch {
        return adminJson(
          {
            error: "REFUND_EXECUTION_PENDING",
            message:
              "Restoration is unconfirmed. Refresh the case before retrying.",
          },
          503,
        );
      }
    }
    return adminJson(await getRefundCase(id));
  } catch (error) {
    return adminError(error);
  }
}
