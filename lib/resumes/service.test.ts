import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseResumeFile = vi.hoisted(() => vi.fn());
const mockValidateResumeFile = vi.hoisted(() => vi.fn());

vi.mock("./parser", () => ({
  parseResumeFile: mockParseResumeFile,
  validateResumeFile: mockValidateResumeFile,
}));

import {
  deleteUserResume,
  getPrimaryResumeText,
  listUserResumes,
  renameUserResume,
  RESUME_BUCKET,
  sanitizeResumeFileName,
  setPrimaryUserResume,
  uploadUserResume,
} from "./service";

type Row = {
  id: string;
  user_id: string;
  label: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  parsed_text: string;
  storage_path: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

const baseRow: Row = {
  id: "resume-1",
  user_id: "user-1",
  label: "Main",
  file_name: "resume.pdf",
  file_mime: "application/pdf",
  file_size: 1024,
  parsed_text: "Backend engineer with AWS and Terraform experience.",
  storage_path: "user-1/resume-1/resume.pdf",
  is_primary: true,
  created_at: "2026-06-15T12:00:00Z",
  updated_at: "2026-06-15T12:00:00Z",
};

function createFakeSupabase(options?: {
  rows?: Row[];
  profileResume?: string | null;
  nextResume?: { id: string } | null;
  uploadError?: Error | null;
  insertError?: Error | null;
  removeError?: Error | null;
  deleteError?: Error | null;
  updateError?: Error | null;
}) {
  const state = {
    rows: options?.rows ?? [baseRow],
    profileResume: options?.profileResume,
    nextResume: options?.nextResume,
    uploadError: options?.uploadError ?? null,
    insertError: options?.insertError ?? null,
    removeError: options?.removeError ?? null,
    deleteError: options?.deleteError ?? null,
    updateError: options?.updateError ?? null,
    inserted: undefined as Record<string, unknown> | undefined,
    updates: [] as Record<string, unknown>[],
    removedPaths: [] as string[],
  };

  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn(async () => ({ error: state.uploadError })),
      remove: vi.fn(async (paths: string[]) => {
        state.removedPaths.push(...paths);
        return { error: state.removeError };
      }),
    })),
  };

  function makeBuilder(table: string) {
    const builder: Record<string, any> = {
      filters: {} as Record<string, unknown>,
      mode: "select",
      updatePayload: undefined as Record<string, unknown> | undefined,
      select: vi.fn(() => builder),
      eq: vi.fn((key: string, value: unknown) => {
        builder.filters[key] = value;
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn((payload: Record<string, unknown>) => {
        builder.mode = "insert";
        state.inserted = payload;
        return builder;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        builder.mode = "update";
        builder.updatePayload = payload;
        state.updates.push(payload);
        return builder;
      }),
      delete: vi.fn(() => {
        builder.mode = "delete";
        return builder;
      }),
      maybeSingle: vi.fn(async () => {
        if (table === "profiles") {
          return {
            data:
              state.profileResume === undefined
                ? null
                : { resume: state.profileResume },
            error: null,
          };
        }

        if (builder.filters.is_primary === true) {
          const primary = state.rows.find((row) => row.is_primary);
          return {
            data: primary ? { parsed_text: primary.parsed_text } : null,
            error: null,
          };
        }

        return { data: state.nextResume ?? null, error: null };
      }),
      single: vi.fn(async () => {
        if (builder.mode === "insert") {
          if (state.insertError)
            return { data: null, error: state.insertError };
          return {
            data: {
              ...baseRow,
              ...state.inserted,
              created_at: baseRow.created_at,
              updated_at: baseRow.updated_at,
            },
            error: null,
          };
        }

        if (builder.mode === "update") {
          if (state.updateError)
            return { data: null, error: state.updateError };
          return {
            data: { ...baseRow, ...builder.updatePayload },
            error: null,
          };
        }

        const row =
          state.rows.find((item) => item.id === builder.filters.id) ??
          state.rows[0] ??
          null;
        return { data: row, error: row ? null : new Error("not found") };
      }),
      then: (resolve: any, reject: any) => {
        let result: unknown;
        if (builder.mode === "delete") {
          result = { data: null, error: state.deleteError };
        } else if (builder.mode === "update") {
          result = { data: null, error: state.updateError };
        } else {
          result = { data: state.rows, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    state,
    client: {
      storage,
      from: vi.fn((table: string) => makeBuilder(table)),
    },
  };
}

describe("sanitizeResumeFileName", () => {
  it("removes path segments and unsafe characters", () => {
    expect(sanitizeResumeFileName("../Nagarjun Resume!!.pdf")).toBe(
      "Nagarjun-Resume.pdf",
    );
  });

  it("falls back to a safe name when the filename is empty after cleanup", () => {
    expect(sanitizeResumeFileName("////")).toBe("resume");
  });
});

describe("resume service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateResumeFile.mockReturnValue(null);
    mockParseResumeFile.mockResolvedValue({
      text: "Parsed resume text",
      truncated: false,
    });
  });

  it("lists resume metadata without raw parsed text", async () => {
    const { client } = createFakeSupabase();

    const resumes = await listUserResumes(client as any, "user-1");

    expect(resumes).toEqual([
      expect.objectContaining({
        id: "resume-1",
        parsed_text_chars: baseRow.parsed_text.length,
        has_storage_file: true,
      }),
    ]);
    expect(resumes[0]).not.toHaveProperty("parsed_text");
  });

  it("gets primary resume text from user_resumes", async () => {
    const { client } = createFakeSupabase();

    await expect(
      getPrimaryResumeText(client as any, "user-1"),
    ).resolves.toEqual({
      text: baseRow.parsed_text,
      source: "user_resumes",
    });
  });

  it("falls back to legacy profile resume and then none", async () => {
    const noPrimary = { ...baseRow, is_primary: false };
    const withProfile = createFakeSupabase({
      rows: [noPrimary],
      profileResume: "Legacy profile resume",
    });
    await expect(
      getPrimaryResumeText(withProfile.client as any, "user-1"),
    ).resolves.toEqual({ text: "Legacy profile resume", source: "profiles" });

    const withoutProfile = createFakeSupabase({
      rows: [noPrimary],
      profileResume: null,
    });
    await expect(
      getPrimaryResumeText(withoutProfile.client as any, "user-1"),
    ).resolves.toEqual({ text: "", source: "none" });
  });

  it("keeps rollback uploads owner-scoped and uses server-only storage", async () => {
    const database = createFakeSupabase({ rows: [] });
    const storage = createFakeSupabase({ rows: [] });
    const file = new File(["resume"], "My Resume.pdf", {
      type: "application/pdf",
    });

    const result = await uploadUserResume(
      database.client as any,
      "user-1",
      file,
      "Uploaded",
      storage.client as any,
    );

    expect(result.resume.label).toBe("Uploaded");
    expect(storage.client.storage.from).toHaveBeenCalledWith(RESUME_BUCKET);
    expect(database.client.storage.from).not.toHaveBeenCalled();
    expect(database.state.inserted).toMatchObject({
      user_id: "user-1",
      parsed_text: "Parsed resume text",
    });
  });

  it("removes the rollback storage object when its row insert fails", async () => {
    const database = createFakeSupabase({
      rows: [],
      insertError: new Error("insert failed"),
    });

    await expect(
      uploadUserResume(
        database.client as any,
        "user-1",
        new File(["resume"], "resume.txt", { type: "text/plain" }),
      ),
    ).rejects.toThrow("insert failed");
    expect(database.state.removedPaths[0]).toContain("user-1/");
  });

  it("rejects invalid rollback files and resume-limit overflow", async () => {
    mockValidateResumeFile.mockReturnValueOnce(
      "Unsupported file type: image/png",
    );
    const invalid = createFakeSupabase();
    await expect(
      uploadUserResume(
        invalid.client as any,
        "user-1",
        new File(["x"], "x.png", { type: "image/png" }),
      ),
    ).rejects.toThrow("Unsupported file type");

    const full = createFakeSupabase({
      rows: Array.from({ length: 5 }, (_, index) => ({
        ...baseRow,
        id: `resume-${index}`,
      })),
    });
    await expect(
      uploadUserResume(
        full.client as any,
        "user-1",
        new File(["x"], "resume.txt", { type: "text/plain" }),
      ),
    ).rejects.toThrow("Resume limit exceeded");
  });

  it("does not create metadata when rollback storage upload fails", async () => {
    const { client, state } = createFakeSupabase({
      rows: [],
      uploadError: new Error("upload failed"),
    });

    await expect(
      uploadUserResume(
        client as any,
        "user-1",
        new File(["x"], "resume.txt", { type: "text/plain" }),
      ),
    ).rejects.toThrow("upload failed");
    expect(state.inserted).toBeUndefined();
  });

  it("renames and sets a primary resume", async () => {
    const { client, state } = createFakeSupabase();

    await expect(
      renameUserResume(client as any, "user-1", "resume-1", "Renamed"),
    ).resolves.toEqual(expect.objectContaining({ label: "Renamed" }));

    await expect(
      setPrimaryUserResume(client as any, "user-1", "resume-1"),
    ).resolves.toEqual(expect.objectContaining({ is_primary: true }));

    expect(state.updates).toContainEqual({ label: "Renamed" });
    expect(state.updates).toContainEqual({ is_primary: false });
    expect(state.updates).toContainEqual({ is_primary: true });
  });

  it("deletes non-primary resumes without promotion", async () => {
    const { client, state } = createFakeSupabase({
      rows: [{ ...baseRow, is_primary: false }],
    });

    await expect(
      deleteUserResume(client as any, "user-1", "resume-1"),
    ).resolves.toEqual({ promoted_resume_id: null });

    expect(state.removedPaths).toEqual([baseRow.storage_path]);
  });

  it("promotes newest remaining resume after deleting a primary resume", async () => {
    const { client } = createFakeSupabase({
      nextResume: { id: "resume-2" },
    });

    await expect(
      deleteUserResume(client as any, "user-1", "resume-1"),
    ).resolves.toEqual({ promoted_resume_id: "resume-2" });
  });

  it("surfaces storage delete errors", async () => {
    const { client } = createFakeSupabase({
      removeError: new Error("storage failed"),
    });

    await expect(
      deleteUserResume(client as any, "user-1", "resume-1"),
    ).rejects.toThrow("storage failed");
  });

  it("surfaces promotion errors after deleting a primary resume", async () => {
    const { client } = createFakeSupabase({
      nextResume: { id: "resume-2" },
      updateError: new Error("promotion failed"),
    });

    await expect(
      deleteUserResume(client as any, "user-1", "resume-1"),
    ).rejects.toThrow("promotion failed");
  });
});
