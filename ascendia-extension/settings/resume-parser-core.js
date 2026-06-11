// Resume parsing helpers shared by settings.js and tests.
// PDF parsing is server-side to avoid bundling PDF.js inside the extension.
(function initResumeParser(root) {
  const DEFAULT_API_URL = "https://www.aletheia.live";

  function normalizeApiUrl(apiUrl) {
    let value = String(apiUrl || DEFAULT_API_URL).trim();
    while (value.endsWith("/") && !value.endsWith("://")) {
      value = value.slice(0, -1);
    }
    return value || DEFAULT_API_URL;
  }

  async function getStoredAccessToken(chromeApi = root.chrome) {
    const result = await chromeApi.storage.local.get("aletheia_auth");
    const auth = result?.aletheia_auth;
    if (!auth?.access_token) {
      throw new Error(
        "Not connected. Please connect the extension before uploading a PDF resume.",
      );
    }
    return auth.access_token;
  }

  async function parseErrorResponse(response) {
    const fallback = response.statusText || "Resume parsing failed";
    let body = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body; use status mapping below.
    }

    if (response.status === 401) {
      return "Session expired. Please reconnect the extension and try again.";
    }
    if (response.status === 413) {
      return "File size must be less than 5MB.";
    }
    if (response.status === 415) {
      return "Unsupported file type. Please upload a PDF or TXT file.";
    }
    if (response.status === 422) {
      return "PDF could not be parsed. If it is scanned or image-based, please convert it to text format.";
    }
    return body?.error || fallback;
  }

  async function parsePdfWithServer(file, options = {}) {
    const apiUrl = normalizeApiUrl(options.apiUrl);
    const chromeApi = options.chromeApi || root.chrome;
    const fetcher = options.fetcher || root.fetch;
    const token =
      options.accessToken || (await getStoredAccessToken(chromeApi));
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetcher(`${apiUrl}/api/profile/parse-resume`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Extension-Source": "aletheia-extension",
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }

    const data = await response.json();
    if (!data?.text || !String(data.text).trim()) {
      throw new Error(
        "No text content found in PDF. The PDF might be image-based.",
      );
    }
    return String(data.text).trim();
  }

  async function readFileContent(file, options = {}) {
    if (file.type === "text/plain") {
      return file.text();
    }
    if (file.type === "application/pdf") {
      return parsePdfWithServer(file, options);
    }
    return `Please convert your resume to PDF format or plain text.

Current file type (${file.type}) cannot be processed.

To use your resume:
1. Save your resume as PDF
2. Or copy/paste your resume text directly in the text area below`;
  }

  root.AletheiaResumeParser = {
    normalizeApiUrl,
    readFileContent,
    parsePdfWithServer,
    getStoredAccessToken,
  };
})(globalThis);
