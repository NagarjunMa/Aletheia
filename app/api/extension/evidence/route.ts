export { POST } from "@/modules/outreach/application/extension-generate.service";

import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/cors";
import {
  evaluateExtensionContract,
  getExtensionContractResponseHeaders,
} from "@/lib/extension-contract";
import { withRequestLifecycle } from "@/lib/request-lifecycle";
import { listConfirmedEvidence } from "@/modules/candidate-context/infrastructure/candidate-context.repository";
import { contractFailureResponse } from "@/modules/outreach/api/extension-generate.mapper";
import { authenticateExtensionRequest } from "@/modules/outreach/infrastructure/extension-generate.repository";

function responseHeaders(request: NextRequest) {
  return {
    ...getCorsHeaders(request, { methods: "GET, POST, OPTIONS" }),
    ...getExtensionContractResponseHeaders(),
    "Cache-Control": "private, no-store",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: responseHeaders(request) });
}

export async function GET(request: NextRequest) {
  return withRequestLifecycle("extension-evidence", request, async (log) => {
    const headers = responseHeaders(request);
    const contract = evaluateExtensionContract(request.headers);
    if (!contract.compatible) return contractFailureResponse(contract, headers);

    try {
      const caller = await authenticateExtensionRequest(request, log);
      if (!caller) {
        return NextResponse.json(
          { error: "Authentication required", code: "AUTH_REQUIRED" },
          { status: 401, headers },
        );
      }

      const evidence = await listConfirmedEvidence(caller);
      return NextResponse.json({ evidence }, { headers });
    } catch {
      log.warn(
        { errorCode: "CANDIDATE_CONTEXT_UNAVAILABLE" },
        "Confirmed evidence list unavailable",
      );
      return NextResponse.json(
        {
          error: "Confirmed stories are temporarily unavailable",
          code: "CANDIDATE_CONTEXT_UNAVAILABLE",
        },
        { status: 503, headers },
      );
    }
  });
}
