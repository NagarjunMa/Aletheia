import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/__tests__/helpers/request";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockRenameUserResume = vi.hoisted(() => vi.fn());
const mockSetPrimaryUserResume = vi.hoisted(() => vi.fn());
const mockDeleteUserResume = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/resumes/service", () => ({
  renameUserResume: mockRenameUserResume,
  setPrimaryUserResume: mockSetPrimaryUserResume,
  deleteUserResume: mockDeleteUserResume,
}));

import { DELETE, PATCH } from "./route";

const MOCK_USER = { id: "user-123", email: "user@example.com" };
const PARAMS = { params: Promise.resolve({ id: "resume-1" }) };

describe("/api/resumes/[id]", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRenameUserResume.mockReset();
    mockSetPrimaryUserResume.mockReset();
    mockDeleteUserResume.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
  });

  it("PATCH renames a resume", async () => {
    mockRenameUserResume.mockResolvedValue({ id: "resume-1", label: "New" });

    const res = await PATCH(
      makeRequest({ method: "PATCH", body: { label: "New" } }),
      PARAMS,
    );

    expect(res.status).toBe(200);
    expect(mockRenameUserResume).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      "resume-1",
      "New",
    );
  });

  it("PATCH sets a resume as primary", async () => {
    mockSetPrimaryUserResume.mockResolvedValue({
      id: "resume-1",
      is_primary: true,
    });

    const res = await PATCH(
      makeRequest({ method: "PATCH", body: { is_primary: true } }),
      PARAMS,
    );

    expect(res.status).toBe(200);
    expect(mockSetPrimaryUserResume).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      "resume-1",
    );
  });

  it("PATCH rejects empty bodies", async () => {
    const res = await PATCH(makeRequest({ method: "PATCH", body: {} }), PARAMS);

    expect(res.status).toBe(400);
  });

  it("DELETE deletes a resume and returns promoted resume metadata", async () => {
    mockDeleteUserResume.mockResolvedValue({ promoted_resume_id: "resume-2" });

    const res = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);

    expect(res.status).toBe(200);
    expect(mockDeleteUserResume).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_USER.id,
      "resume-1",
    );
    const body = await res.json();
    expect(body.promoted_resume_id).toBe("resume-2");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE(makeRequest({ method: "DELETE" }), PARAMS);

    expect(res.status).toBe(401);
  });
});
