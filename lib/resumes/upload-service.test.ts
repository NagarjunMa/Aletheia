import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateResumeBytes = vi.hoisted(() => vi.fn());

vi.mock("./validator", () => ({
  validateResumeBytes: mockValidateResumeBytes,
}));

import {
  cancelResumeUpload,
  finalizeResumeUpload,
  reserveResumeUpload,
  ResumeUploadServiceError,
} from "./upload-service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const UPLOAD_ID = "00000000-0000-4000-8000-000000000002";
const RESUME_ID = "00000000-0000-4000-8000-000000000003";
const STORAGE_PATH = `${USER_ID}/${UPLOAD_ID}.txt`;
const FUTURE = "2099-01-01T00:00:00.000Z";

type TestSnapshot = {
  id: string;
  user_id: string;
  state: string;
  failure_code: string | null;
  retry_count: number;
  expires_at: string;
  resume_id: string | null;
  quality_codes: string[];
  page_count: number | null;
  parsed_character_count: number | null;
};

const snapshot: TestSnapshot = {
  id: UPLOAD_ID,
  user_id: USER_ID,
  state: "reserved",
  failure_code: null,
  retry_count: 0,
  expires_at: FUTURE,
  resume_id: null,
  quality_codes: [],
  page_count: null,
  parsed_character_count: null,
};

const claim = {
  upload_id: UPLOAD_ID,
  user_id: USER_ID,
  file_name: "resume.txt",
  declared_mime: "text/plain",
  declared_size: 400,
  storage_path: STORAGE_PATH,
  retry_count: 1,
};

const accepted = {
  status: "ready" as const,
  detectedMime: "text/plain" as const,
  parsedText: "a".repeat(400),
  contentSha256: "a".repeat(64),
  qualityCodes: [],
  metrics: {
    byteCount: 400,
    characterCount: 400,
    letterCount: 400,
    wordCount: 1,
    pageCount: null,
    charactersPerPage: null,
    repeatedLineRatio: 0,
    suspiciousCharacterCount: 0,
    suspiciousCharacterRatio: 0,
    truncated: false,
  },
};

type FakeOptions = {
  snapshots?: Array<TestSnapshot | null>;
  rpc?: Record<string, Array<{ data: unknown; error: unknown }>>;
  download?: { data: Blob | null; error: unknown };
  downloads?: Record<string, Array<{ data: Blob | null; error: unknown }>>;
  moves?: Array<{ data: unknown; error: unknown }>;
  removes?: Array<{ data: unknown; error: unknown }>;
};

function createFakeSupabase(options: FakeOptions = {}) {
  const snapshots = [...(options.snapshots ?? [snapshot])];
  const rpcQueues = Object.fromEntries(
    Object.entries(options.rpc ?? {}).map(([key, value]) => [key, [...value]]),
  );
  const moveQueue = [...(options.moves ?? [])];
  const removeQueue = [...(options.removes ?? [])];
  const downloadQueues = Object.fromEntries(
    Object.entries(options.downloads ?? {}).map(([key, value]) => [
      key,
      [...value],
    ]),
  );
  const calls = {
    rpc: [] as Array<{ name: string; args: unknown }>,
    buckets: [] as string[],
    moves: [] as Array<{
      bucket: string;
      from: string;
      to: string;
      options: unknown;
    }>,
    removes: [] as Array<{ bucket: string; paths: string[] }>,
  };

  const client = {
    rpc: vi.fn(async (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      return (
        rpcQueues[name]?.shift() ?? {
          data: null,
          error: new Error(`Unexpected RPC: ${name}`),
        }
      );
    }),
    from: vi.fn(() => {
      const builder: Record<string, any> = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({
          data: snapshots.shift() ?? null,
          error: null,
        })),
      };
      return builder;
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        calls.buckets.push(bucket);
        return {
          download: vi.fn(
            async () =>
              downloadQueues[bucket]?.shift() ??
              options.download ?? {
                data: new Blob([new Uint8Array(400)]),
                error: null,
              },
          ),
          move: vi.fn(
            async (from: string, to: string, moveOptions: unknown) => {
              calls.moves.push({ bucket, from, to, options: moveOptions });
              return (
                moveQueue.shift() ?? { data: { message: "ok" }, error: null }
              );
            },
          ),
          remove: vi.fn(async (paths: string[]) => {
            calls.removes.push({ bucket, paths });
            return removeQueue.shift() ?? { data: [], error: null };
          }),
        };
      }),
    },
  };
  return { client, calls };
}

function finalizeWithFakeClient(client: unknown) {
  return finalizeResumeUpload(
    client as any,
    () => client as any,
    USER_ID,
    UPLOAD_ID,
  );
}

describe("resume upload service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateResumeBytes.mockResolvedValue(accepted);
  });

  it("reserves only a server-generated quarantine path and safe upload options", async () => {
    const { client, calls } = createFakeSupabase({
      rpc: {
        reserve_resume_upload: [
          {
            data: [
              {
                upload_id: UPLOAD_ID,
                bucket_id: "resume-quarantine",
                storage_path: STORAGE_PATH,
                expires_at: FUTURE,
              },
            ],
            error: null,
          },
        ],
      },
    });

    await expect(
      reserveResumeUpload(client as any, {
        fileName: "../My Resume.txt",
        declaredMime: "text/plain",
        declaredSize: 400,
      }),
    ).resolves.toEqual({
      uploadId: UPLOAD_ID,
      bucketId: "resume-quarantine",
      storagePath: STORAGE_PATH,
      expiresAt: FUTURE,
      uploadOptions: { contentType: "text/plain", upsert: false },
    });
    expect(calls.rpc[0]).toEqual({
      name: "reserve_resume_upload",
      args: expect.objectContaining({ p_file_name: "My-Resume.txt" }),
    });
  });

  it("maps reservation limits without exposing database messages", async () => {
    const { client } = createFakeSupabase({
      rpc: {
        reserve_resume_upload: [
          {
            data: null,
            error: {
              code: "23514",
              message: "hourly resume upload limit exceeded",
            },
          },
        ],
      },
    });

    await expect(
      reserveResumeUpload(client as any, {
        fileName: "resume.txt",
        declaredMime: "text/plain",
        declaredSize: 400,
      }),
    ).rejects.toMatchObject({
      code: "UPLOAD_RATE_LIMIT_REACHED",
      status: 429,
    });
  });

  it("keeps a valid extension when a Unicode-only file stem is sanitized", async () => {
    const { client, calls } = createFakeSupabase({
      rpc: {
        reserve_resume_upload: [
          {
            data: [
              {
                upload_id: UPLOAD_ID,
                bucket_id: "resume-quarantine",
                storage_path: STORAGE_PATH,
                expires_at: FUTURE,
              },
            ],
            error: null,
          },
        ],
      },
    });

    await reserveResumeUpload(client as any, {
      fileName: "简历.txt",
      declaredMime: "text/plain",
      declaredSize: 400,
    });
    expect(calls.rpc[0]?.args).toMatchObject({ p_file_name: "resume.txt" });
  });

  it("returns an already-ready upload without reading storage", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        {
          ...snapshot,
          state: "ready",
          resume_id: RESUME_ID,
          parsed_character_count: 400,
          quality_codes: ["SHORT_USABLE_TEXT"],
        },
      ],
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "warning",
      resumeId: RESUME_ID,
      metrics: { characterCount: 400 },
    });
    expect(calls.buckets).toEqual([]);
  });

  it("does not create a privileged client until authenticated ownership is proven", async () => {
    const authenticated = createFakeSupabase({ snapshots: [null] });
    const factory = vi.fn();

    await expect(
      finalizeResumeUpload(
        authenticated.client as any,
        factory,
        USER_ID,
        UPLOAD_ID,
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_FOUND", status: 404 });
    expect(factory).not.toHaveBeenCalled();
  });

  it("acknowledges, claims, validates, promotes, and atomically completes", async () => {
    const { client, calls } = createFakeSupabase({
      rpc: {
        mark_resume_upload_uploaded: [
          { data: [{ upload_state: "uploaded" }], error: null },
        ],
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          {
            data: [
              { completed_resume_id: RESUME_ID, already_completed: false },
            ],
            error: null,
          },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "ready",
      resumeId: RESUME_ID,
    });
    expect(calls.rpc.map((entry) => entry.name)).toEqual([
      "mark_resume_upload_uploaded",
      "claim_resume_upload",
      "complete_resume_upload",
    ]);
    expect(calls.rpc).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: expect.objectContaining({
            p_upload_id: UPLOAD_ID,
            p_user_id: USER_ID,
          }),
        }),
      ]),
    );
    expect(calls.moves).toContainEqual({
      bucket: "resume-quarantine",
      from: STORAGE_PATH,
      to: STORAGE_PATH,
      options: { destinationBucket: "user-resumes" },
    });
  });

  it("records deterministic validation rejection and deletes quarantine bytes", async () => {
    mockValidateResumeBytes.mockResolvedValue({
      status: "rejected",
      code: "INVALID_UTF8",
      publicMessage: "invalid",
    });
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        reject_resume_upload: [
          { data: [{ upload_state: "rejected" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "rejected",
      code: "INVALID_UTF8",
      retryable: false,
    });
    expect(calls.removes).toEqual([
      { bucket: "resume-quarantine", paths: [STORAGE_PATH] },
    ]);
  });

  it("marks storage download failures as explicitly retryable", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      download: { data: null, error: new Error("storage unavailable") },
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        reject_resume_upload: [
          { data: [{ upload_state: "failed" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "failed",
      code: "TEMPORARY_PROCESSING_FAILURE",
      retryable: true,
    });
    expect(calls.rpc.at(-1)?.args).toMatchObject({ p_retryable: true });
  });

  it("records unexpected validator failures as retryable instead of leaving validation stuck", async () => {
    mockValidateResumeBytes.mockRejectedValue(
      new Error("unexpected parser bug"),
    );
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        reject_resume_upload: [
          { data: [{ upload_state: "failed" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "failed",
      code: "TEMPORARY_PROCESSING_FAILURE",
      retryable: true,
    });
    expect(calls.rpc.at(-1)).toMatchObject({
      name: "reject_resume_upload",
      args: expect.objectContaining({ p_retryable: true }),
    });
  });

  it("continues completion when a failed move response has matching promoted bytes", async () => {
    const promotedBytes = new Uint8Array(400);
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      downloads: {
        "user-resumes": [{ data: new Blob([promotedBytes]), error: null }],
      },
      moves: [{ data: null, error: new Error("response lost") }],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          {
            data: [
              { completed_resume_id: RESUME_ID, already_completed: false },
            ],
            error: null,
          },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "ready",
      resumeId: RESUME_ID,
    });
    expect(calls.buckets).toContain("user-resumes");
    expect(calls.rpc.map((entry) => entry.name)).toContain(
      "complete_resume_upload",
    );
    expect(calls.removes).toContainEqual({
      bucket: "resume-quarantine",
      paths: [STORAGE_PATH],
    });
  });

  it("fails closed and removes mismatched bytes after an ambiguous move", async () => {
    const mismatchedBytes = new Uint8Array(400).fill(1);
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      downloads: {
        "user-resumes": [{ data: new Blob([mismatchedBytes]), error: null }],
      },
      moves: [{ data: null, error: new Error("response lost") }],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        reject_resume_upload: [
          { data: [{ upload_state: "rejected" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "rejected",
      code: "PERSISTENCE_FAILURE",
      retryable: false,
    });
    expect(calls.removes).toContainEqual({
      bucket: "resume-quarantine",
      paths: [STORAGE_PATH],
    });
    expect(calls.removes).toContainEqual({
      bucket: "user-resumes",
      paths: [STORAGE_PATH],
    });
    expect(calls.rpc.map((entry) => entry.name)).not.toContain(
      "complete_resume_upload",
    );
  });

  it("keeps a move failure retryable when no promoted object exists", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "uploaded" }],
      downloads: {
        "user-resumes": [{ data: null, error: new Error("not found") }],
      },
      moves: [{ data: null, error: new Error("move failed") }],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        reject_resume_upload: [
          { data: [{ upload_state: "failed" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "failed",
      code: "TEMPORARY_PROCESSING_FAILURE",
      retryable: true,
    });
    expect(calls.rpc.at(-1)?.args).toMatchObject({ p_retryable: true });
  });

  it("recovers a retry when an earlier ambiguous move already promoted the object", async () => {
    const promotedBytes = new Uint8Array(400);
    const { client, calls } = createFakeSupabase({
      snapshots: [
        {
          ...snapshot,
          state: "failed",
          failure_code: "TEMPORARY_PROCESSING_FAILURE",
          retry_count: 1,
        },
      ],
      downloads: {
        "resume-quarantine": [
          { data: null, error: new Error("object not found") },
        ],
        "user-resumes": [{ data: new Blob([promotedBytes]), error: null }],
      },
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          {
            data: [
              { completed_resume_id: RESUME_ID, already_completed: false },
            ],
            error: null,
          },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "ready",
      resumeId: RESUME_ID,
    });
    expect(calls.buckets.slice(0, 2)).toEqual([
      "resume-quarantine",
      "user-resumes",
    ]);
    expect(calls.moves).toEqual([]);
    expect(calls.removes).toContainEqual({
      bucket: "resume-quarantine",
      paths: [STORAGE_PATH],
    });
  });

  it("rejects a same-user duplicate and deletes the promoted object", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        { ...snapshot, state: "uploaded" },
        { ...snapshot, state: "validating" },
      ],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          { data: null, error: { code: "23505", message: "duplicate" } },
        ],
        reject_resume_upload: [
          { data: [{ upload_state: "rejected" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "rejected",
      code: "DUPLICATE_RESUME",
    });
    expect(calls.removes).toContainEqual({
      bucket: "user-resumes",
      paths: [STORAGE_PATH],
    });
  });

  it("restores promoted bytes before recording a retryable completion failure", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        { ...snapshot, state: "uploaded" },
        { ...snapshot, state: "validating" },
      ],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          { data: null, error: { code: "XX000", message: "failed" } },
          { data: null, error: { code: "XX000", message: "failed" } },
        ],
        reject_resume_upload: [
          { data: [{ upload_state: "failed" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "failed",
      retryable: true,
    });
    expect(calls.moves).toContainEqual({
      bucket: "user-resumes",
      from: STORAGE_PATH,
      to: STORAGE_PATH,
      options: { destinationBucket: "resume-quarantine" },
    });
  });

  it("reconciles an ambiguous completion response without deleting a ready file", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        { ...snapshot, state: "uploaded" },
        {
          ...snapshot,
          state: "ready",
          resume_id: RESUME_ID,
          parsed_character_count: 400,
        },
      ],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          { data: null, error: { code: "XX000", message: "unknown outcome" } },
          { data: null, error: { code: "XX000", message: "unknown outcome" } },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "ready",
      resumeId: RESUME_ID,
    });
    expect(calls.removes).toEqual([]);
    expect(calls.moves).toHaveLength(1);
  });

  it("deletes a promoted object when restoration fails and disables retry", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        { ...snapshot, state: "uploaded" },
        { ...snapshot, state: "validating" },
      ],
      moves: [
        { data: { message: "promoted" }, error: null },
        { data: null, error: new Error("restore failed") },
      ],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          { data: null, error: { code: "XX000", message: "failed" } },
          { data: null, error: { code: "XX000", message: "failed" } },
        ],
        reject_resume_upload: [
          { data: [{ upload_state: "rejected" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "rejected",
      code: "PERSISTENCE_FAILURE",
      retryable: false,
    });
    expect(calls.removes).toContainEqual({
      bucket: "user-resumes",
      paths: [STORAGE_PATH],
    });
  });

  it("compensates when completion returns no row without an explicit error", async () => {
    const { client, calls } = createFakeSupabase({
      snapshots: [
        { ...snapshot, state: "uploaded" },
        { ...snapshot, state: "validating" },
      ],
      rpc: {
        claim_resume_upload: [{ data: [claim], error: null }],
        complete_resume_upload: [
          { data: [], error: null },
          { data: [], error: null },
        ],
        reject_resume_upload: [
          { data: [{ upload_state: "failed" }], error: null },
        ],
      },
    });

    await expect(finalizeWithFakeClient(client)).resolves.toMatchObject({
      status: "failed",
      retryable: true,
    });
    expect(calls.moves).toContainEqual({
      bucket: "user-resumes",
      from: STORAGE_PATH,
      to: STORAGE_PATH,
      options: { destinationBucket: "resume-quarantine" },
    });
  });

  it("does not retry validating or terminally failed uploads", async () => {
    const processing = createFakeSupabase({
      snapshots: [{ ...snapshot, state: "validating" }],
    });
    await expect(
      finalizeWithFakeClient(processing.client),
    ).rejects.toMatchObject({ code: "UPLOAD_PROCESSING", status: 409 });

    const terminal = createFakeSupabase({
      snapshots: [
        {
          ...snapshot,
          state: "failed",
          failure_code: "TEMPORARY_PROCESSING_FAILURE",
          retry_count: 3,
        },
      ],
    });
    await expect(finalizeWithFakeClient(terminal.client)).rejects.toMatchObject(
      { code: "UPLOAD_RETRY_LIMIT_REACHED" },
    );
  });

  it("creates the service client only after authenticated cancellation succeeds", async () => {
    const authenticated = createFakeSupabase({
      rpc: {
        cancel_resume_upload: [
          {
            data: [
              {
                upload_state: "canceled",
                storage_path: STORAGE_PATH,
                changed: true,
              },
            ],
            error: null,
          },
        ],
      },
    });
    const service = createFakeSupabase();
    const factory = vi.fn(() => service.client as any);

    await expect(
      cancelResumeUpload(authenticated.client as any, UPLOAD_ID, factory),
    ).resolves.toEqual({ status: "canceled", uploadId: UPLOAD_ID });
    expect(factory).toHaveBeenCalledOnce();
    expect(service.calls.removes).toEqual([
      { bucket: "resume-quarantine", paths: [STORAGE_PATH] },
    ]);
  });

  it("returns the same cancellation response when the RPC reports no state change", async () => {
    const authenticated = createFakeSupabase({
      rpc: {
        cancel_resume_upload: [
          {
            data: [
              {
                upload_state: "canceled",
                storage_path: STORAGE_PATH,
                changed: false,
              },
            ],
            error: null,
          },
        ],
      },
    });
    const service = createFakeSupabase();

    await expect(
      cancelResumeUpload(
        authenticated.client as any,
        UPLOAD_ID,
        () => service.client as any,
      ),
    ).resolves.toEqual({ status: "canceled", uploadId: UPLOAD_ID });
  });

  it("never creates a service client when cancellation ownership is not proven", async () => {
    const authenticated = createFakeSupabase({
      rpc: {
        cancel_resume_upload: [
          { data: null, error: { code: "P0002", message: "not found" } },
        ],
      },
    });
    const factory = vi.fn();

    await expect(
      cancelResumeUpload(authenticated.client as any, UPLOAD_ID, factory),
    ).rejects.toBeInstanceOf(ResumeUploadServiceError);
    expect(factory).not.toHaveBeenCalled();
  });
});
