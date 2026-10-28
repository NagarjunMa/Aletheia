import { describe, expect, it, vi } from "vitest";
import { candidateProfileInputSchema } from "@/lib/candidate-profile/schema";
import type { CandidateGroundingData } from "@/modules/candidate-context/domain/candidate-context.types";
import { OutreachGroundingUnavailableError } from "../domain/outreach-grounding.types";
import { prepareOutreachGroundingContext } from "./prepare-outreach-grounding-context";
import { createGenerationTiming } from "@/lib/generation-timing";

const caller = {
  userId: "user-1",
  email: "person@example.com",
  accessToken: "verified-token",
};
const target = {
  category: "linkedin_connection" as const,
  profileMarkdown: "Target engineer profile",
  jobDescription: "",
  conversationContext: "",
};
const candidate: CandidateGroundingData = {
  identity: { fullName: "Candidate", linkedinUrl: "" },
  profile: candidateProfileInputSchema.parse({ currentRole: "Engineer" }),
  confirmedEvidence: [],
  resume: { text: "", source: "none" },
};

describe("prepareOutreachGroundingContext", () => {
  it("writes safe preparation metadata through the supplied request logger", async () => {
    const info = vi.fn();
    const logger = {
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };
    await prepareOutreachGroundingContext(
      { caller, target, logger },
      { loadCandidateData: async () => candidate },
    );
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "outreach.grounding.prepared" }),
      expect.any(String),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(caller.accessToken);
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      target.profileMarkdown,
    );
  });
  it("uses the same load/build timing stages as application answers", async () => {
    let time = 0;
    const timing = createGenerationTiming(() => time);
    await prepareOutreachGroundingContext(
      { caller, target, timing },
      {
        loadCandidateData: async () => {
          time += 19;
          return candidate;
        },
        recordGrounding: () => {
          time += 2;
        },
      },
    );
    timing.enter("rateLimit");
    expect(timing.finish(200).stages).toMatchObject({
      groundingLoad: 19,
      groundingBuild: 2,
    });
  });
  it("uses the verified caller and records content-free metadata only", async () => {
    const loadCandidateData = vi.fn().mockResolvedValue(candidate);
    const recordGrounding = vi.fn();
    const result = await prepareOutreachGroundingContext(
      { caller, target },
      { loadCandidateData, recordGrounding },
    );
    expect(loadCandidateData).toHaveBeenCalledWith({
      userId: caller.userId,
      accessToken: caller.accessToken,
    });
    expect(result.metadata.groundingLevel).toBe("profile_grounded");
    expect(result.identity).toEqual(candidate.identity);
    expect(JSON.stringify(recordGrounding.mock.calls)).not.toContain(
      caller.accessToken,
    );
    expect(JSON.stringify(recordGrounding.mock.calls)).not.toContain(
      caller.userId,
    );
    expect(JSON.stringify(recordGrounding.mock.calls)).not.toContain(
      "Target engineer profile",
    );
  });

  it("maps all candidate-context failures to the stable preparation error", async () => {
    await expect(
      prepareOutreachGroundingContext(
        { caller, target },
        {
          loadCandidateData: vi
            .fn()
            .mockRejectedValue(new Error("private database detail")),
        },
      ),
    ).rejects.toBeInstanceOf(OutreachGroundingUnavailableError);
  });
});
