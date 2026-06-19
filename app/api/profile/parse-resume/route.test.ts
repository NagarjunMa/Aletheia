import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeMultipartRequest(): Request {
  const formData = new FormData();
  formData.append(
    "file",
    new File(["resume"], "resume.txt", { type: "text/plain" }),
  );

  return new Request("http://localhost:3000/api/profile/parse-resume", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/profile/parse-resume", () => {
  it("is disabled so parsed resume text is not returned to clients", async () => {
    const res = await POST(makeMultipartRequest() as never);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("RESUME_PARSE_DEPRECATED");
    expect(body.error).toMatch(/\/api\/resumes/i);
    expect(body).not.toHaveProperty("text");
  });
});
