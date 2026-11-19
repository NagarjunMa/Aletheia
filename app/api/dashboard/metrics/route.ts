import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { getDashboardMetrics } from "@/modules/dashboard/application/get-dashboard-metrics";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return withRequestLifecycle("dashboard-metrics", request, async (log) => {
    const headers = { "Cache-Control": "private, no-store" };
    try {
      const db = await createClient();
      const {
        data: { user },
        error,
      } = await db.auth.getUser();
      if (error || !user)
        return NextResponse.json(
          { code: "UNAUTHORIZED" },
          { status: 401, headers },
        );
      const query = Object.fromEntries(request.nextUrl.searchParams);
      const parsed = z
        .object({
          days: z.coerce.number().int().min(1).max(90).default(30),
        })
        .strict()
        .safeParse(query);
      if (!parsed.success)
        return NextResponse.json(
          { code: "INVALID_DASHBOARD_PERIOD" },
          { status: 400, headers },
        );
      const metrics = await getDashboardMetrics(db, user.id, parsed.data.days);
      return NextResponse.json(metrics, { headers });
    } catch {
      log.error(
        { errorCode: "DASHBOARD_METRICS_UNAVAILABLE" },
        "Dashboard data unavailable",
      );
      return NextResponse.json(
        { code: "DASHBOARD_METRICS_UNAVAILABLE" },
        { status: 503, headers },
      );
    }
  });
}
