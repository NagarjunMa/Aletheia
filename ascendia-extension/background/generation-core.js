// Pure helpers for the generation message boundary. Keeping these functions
// free of chrome.* access makes strict payload and error propagation testable.

export function buildGenerationRequestData(payload, acceptedExamples) {
  if (payload.category === "yc_application") {
    return payload;
  }

  return {
    ...payload,
    acceptedExamples,
  };
}

export function serializeGenerationError(error) {
  const details = error?.apiResponse || {};
  const now = Date.now();
  const resetTime =
    error?.status === 429 &&
    Number.isSafeInteger(details.resetTime) &&
    details.resetTime > now &&
    details.resetTime <= now + 86_400_000
      ? details.resetTime
      : undefined;
  const retryAfterSeconds =
    Number.isSafeInteger(error?.retryAfterSeconds) &&
    error.retryAfterSeconds > 0 &&
    error.retryAfterSeconds <= 86_400
      ? error.retryAfterSeconds
      : resetTime
        ? Math.ceil((resetTime - now) / 1000)
        : undefined;
  return {
    success: false,
    ...(resetTime ? { resetTime } : {}),
    ...(error?.status === 429 && retryAfterSeconds
      ? { retryAfterSeconds }
      : {}),
    ...(["none", "refunded", "refund_pending"].includes(details.billing)
      ? { billing: details.billing }
      : {}),
    ...(typeof details.refundReference === "string" &&
    /^[0-9a-f-]{36}$/i.test(details.refundReference)
      ? { refundReference: details.refundReference }
      : {}),
    ...(details.quotaRestoration === "pending_review"
      ? { quotaRestoration: "pending_review" }
      : {}),
    error: details.error || error?.message || "Generation failed",
    message: details.message || error?.message || "Generation failed",
    ...(error?.status ? { status: error.status } : {}),
    ...(error?.code || details.code
      ? { code: error?.code || details.code }
      : {}),
    ...(error?.requestId ? { requestId: error.requestId } : {}),
    ...(error?.authCause || details.cause
      ? { cause: error?.authCause || details.cause }
      : {}),
    ...(Array.isArray(details.missingFields)
      ? { missingFields: details.missingFields }
      : {}),
    ...(Array.isArray(details.recommendedFields)
      ? { recommendedFields: details.recommendedFields }
      : {}),
    ...(details.applicationProfileUrl
      ? { applicationProfileUrl: details.applicationProfileUrl }
      : {}),
    ...(error?.updateUrl || details.chromeWebStoreUrl
      ? { updateUrl: error?.updateUrl || details.chromeWebStoreUrl }
      : {}),
  };
}
