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
  return {
    success: false,
    error: details.error || error?.message || "Generation failed",
    message: details.message || error?.message || "Generation failed",
    ...(error?.status ? { status: error.status } : {}),
    ...(error?.code || details.code
      ? { code: error?.code || details.code }
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
