"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  getApplicationProfileReadiness,
  TARGET_COMPANY_STAGES,
  type CandidateEvidenceInput,
  type CandidateProfileInput,
} from "@/lib/candidate-profile/schema";
import type { CandidateEvidenceRecord } from "@/lib/candidate-profile/service";
import {
  deleteCandidateEvidence,
  saveCandidateEvidence,
  saveCandidateProfileCategory,
} from "./actions";
import {
  EVIDENCE_KIND_OPTIONS,
  PROFILE_CATEGORY_OPTIONS,
  formatListInput,
  parseListInput,
  type ProfileCategoryOption,
} from "./form-helpers";

type Props = {
  initialProfile: CandidateProfileInput;
  initialEvidence: CandidateEvidenceRecord[];
  hasPrimaryResume: boolean;
};

type Notice = { type: "success" | "error"; message: string } | null;
type ProfileNotice = {
  categoryId: ProfileCategoryOption["id"];
  type: "success" | "error";
  message: string;
} | null;

const EMPTY_EVIDENCE: CandidateEvidenceInput = {
  kind: "achievement",
  title: "",
  context: "",
  actions: "",
  outcome: "",
  metrics: [],
  skills: [],
  links: [],
  confirmed: false,
  sortOrder: 0,
};

const STAGE_LABELS: Record<(typeof TARGET_COMPANY_STAGES)[number], string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a_b: "Series A-B",
  growth: "Growth",
  any: "Any stage",
};

const inputClass =
  "mt-2 w-full rounded-lg border border-accent/20 bg-background/55 px-3.5 py-3 text-sm text-foreground outline-hidden transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/60 focus:border-accent/55 focus:ring-2 focus:ring-accent/15";

export default function ApplicationProfileEditor({
  initialProfile,
  initialEvidence,
  hasPrimaryResume,
}: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [editor, setEditor] = useState<CandidateEvidenceInput | null>(null);
  const [profileNotice, setProfileNotice] = useState<ProfileNotice>(null);
  const [evidenceNotice, setEvidenceNotice] = useState<Notice>(null);
  const [profilePending, startProfileTransition] = useTransition();
  const [evidencePending, startEvidenceTransition] = useTransition();

  const readiness = useMemo(
    () =>
      getApplicationProfileReadiness({
        profile,
        evidence,
        hasPrimaryResume,
      }),
    [evidence, hasPrimaryResume, profile],
  );

  const updateProfile = <Key extends keyof CandidateProfileInput>(
    key: Key,
    value: CandidateProfileInput[Key],
  ) => setProfile((current) => ({ ...current, [key]: value }));

  const submitProfile =
    (category: ProfileCategoryOption) => (event: React.FormEvent) => {
      event.preventDefault();
      setProfileNotice(null);
      startProfileTransition(async () => {
        const result = await saveCandidateProfileCategory(category.id, profile);
        setProfileNotice({
          categoryId: category.id,
          type: result.ok ? "success" : "error",
          message: result.ok ? `${category.label} saved.` : result.error,
        });
      });
    };

  const submitEvidence = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setEvidenceNotice(null);
    startEvidenceTransition(async () => {
      const result = await saveCandidateEvidence(editor);
      if (!result.ok) {
        setEvidenceNotice({ type: "error", message: result.error });
        return;
      }

      if (editor.id) {
        setEvidence((items) =>
          items.map((item) =>
            item.id === editor.id
              ? ({ ...editor, id: editor.id } as CandidateEvidenceRecord)
              : item,
          ),
        );
      }
      setEditor(null);
      setEvidenceNotice({ type: "success", message: "Evidence story saved." });
      router.refresh();
    });
  };

  const removeEvidence = (item: CandidateEvidenceRecord) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    setEvidenceNotice(null);
    startEvidenceTransition(async () => {
      const result = await deleteCandidateEvidence(item.id);
      if (!result.ok) {
        setEvidenceNotice({ type: "error", message: result.error });
        return;
      }
      setEvidence((items) => items.filter((entry) => entry.id !== item.id));
      if (editor?.id === item.id) setEditor(null);
      setEvidenceNotice({
        type: "success",
        message: "Evidence story deleted.",
      });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-6">
        <div className="space-y-3">
          <ProfileSection
            category={PROFILE_CATEGORY_OPTIONS[0]}
            title="What are you responsible for now?"
            description="This anchors answers in your actual level, scope, and day-to-day ownership."
            defaultOpen
            pending={profilePending}
            notice={
              profileNotice?.categoryId === "current_work"
                ? profileNotice
                : null
            }
            onSubmit={submitProfile(PROFILE_CATEGORY_OPTIONS[0])}
          >
            <TextField
              id="current-role"
              label="Current role"
              value={profile.currentRole}
              maxLength={160}
              placeholder="Platform Engineer"
              onChange={(value) => updateProfile("currentRole", value)}
            />
            <TextAreaField
              id="current-responsibilities"
              label="Current responsibilities"
              value={profile.currentResponsibilities}
              maxLength={3000}
              rows={5}
              placeholder="Describe what you own, who you work with, and the systems or outcomes you are accountable for."
              onChange={(value) =>
                updateProfile("currentResponsibilities", value)
              }
            />
          </ProfileSection>

          <ProfileSection
            category={PROFILE_CATEGORY_OPTIONS[1]}
            title="Where do you want to go next?"
            description="Targeting data helps the generator emphasize relevant evidence without inventing fit."
            pending={profilePending}
            notice={
              profileNotice?.categoryId === "direction" ? profileNotice : null
            }
            onSubmit={submitProfile(PROFILE_CATEGORY_OPTIONS[1])}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <ListField
                id="target-roles"
                label="Target roles"
                hint="One per line or comma-separated"
                value={profile.targetRoles}
                maxItems={10}
                placeholder={"Founding Engineer\nPlatform Engineer"}
                onChange={(value) => updateProfile("targetRoles", value)}
              />
              <ListField
                id="target-industries"
                label="Target industries"
                hint="Up to 10"
                value={profile.targetIndustries}
                maxItems={10}
                placeholder={"Developer tools\nAI infrastructure"}
                onChange={(value) => updateProfile("targetIndustries", value)}
              />
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-white">
                Target company stages
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {TARGET_COMPANY_STAGES.map((stage) => {
                  const checked = profile.targetCompanyStages.includes(stage);
                  return (
                    <label
                      key={stage}
                      className={`cursor-pointer rounded-full border px-3.5 py-2 text-sm transition ${
                        checked
                          ? "border-accent/40 bg-accent/18 text-white"
                          : "border-accent/13 bg-background/38 text-muted-foreground hover:border-accent/26"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          updateProfile(
                            "targetCompanyStages",
                            checked
                              ? profile.targetCompanyStages.filter(
                                  (value) => value !== stage,
                                )
                              : [...profile.targetCompanyStages, stage],
                          )
                        }
                      />
                      {STAGE_LABELS[stage]}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <TextAreaField
              id="startup-motivation"
              label="Why startups and early-stage companies?"
              value={profile.startupMotivation}
              maxLength={2000}
              rows={4}
              placeholder="Explain what genuinely attracts you to the pace, ownership, customer proximity, or stage."
              onChange={(value) => updateProfile("startupMotivation", value)}
            />
            <TextAreaField
              id="career-goals"
              label="Career goals"
              value={profile.careerGoals}
              maxLength={2000}
              rows={4}
              placeholder="What do you want to learn, own, or become known for?"
              onChange={(value) => updateProfile("careerGoals", value)}
            />
          </ProfileSection>

          <ProfileSection
            category={PROFILE_CATEGORY_OPTIONS[2]}
            title="Where can a reviewer verify your work?"
            description="Leave any field blank if it does not apply. Only links you enter can be used."
            pending={profilePending}
            notice={
              profileNotice?.categoryId === "proof_links" ? profileNotice : null
            }
            onSubmit={submitProfile(PROFILE_CATEGORY_OPTIONS[2])}
          >
            <div className="grid gap-5 md:grid-cols-3">
              <TextField
                id="github-url"
                type="url"
                label="GitHub"
                value={profile.githubUrl}
                maxLength={2048}
                placeholder="https://github.com/..."
                onChange={(value) => updateProfile("githubUrl", value)}
              />
              <TextField
                id="linkedin-url"
                type="url"
                label="LinkedIn"
                value={profile.linkedinUrl}
                maxLength={2048}
                placeholder="https://linkedin.com/in/..."
                onChange={(value) => updateProfile("linkedinUrl", value)}
              />
              <TextField
                id="portfolio-url"
                type="url"
                label="Portfolio"
                value={profile.portfolioUrl}
                maxLength={2048}
                placeholder="https://..."
                onChange={(value) => updateProfile("portfolioUrl", value)}
              />
            </div>
          </ProfileSection>

          <ProfileSection
            category={PROFILE_CATEGORY_OPTIONS[3]}
            title="Practical application details"
            description="These fields prevent generic or incorrect answers to common application questions."
            pending={profilePending}
            notice={
              profileNotice?.categoryId === "logistics" ? profileNotice : null
            }
            onSubmit={submitProfile(PROFILE_CATEGORY_OPTIONS[3])}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                id="location"
                label="Location"
                value={profile.location}
                maxLength={160}
                placeholder="New York, NY"
                onChange={(value) => updateProfile("location", value)}
              />
              <div>
                <label
                  htmlFor="relocation-preference"
                  className="text-sm font-semibold text-white"
                >
                  Open to relocation?
                </label>
                <select
                  id="relocation-preference"
                  value={profile.relocationPreference}
                  onChange={(event) =>
                    updateProfile(
                      "relocationPreference",
                      event.target
                        .value as CandidateProfileInput["relocationPreference"],
                    )
                  }
                  className={inputClass}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="open">Open / depends on the role</option>
                </select>
              </div>
              <TextAreaField
                id="work-authorization"
                label="Work authorization"
                value={profile.workAuthorization}
                maxLength={500}
                rows={3}
                placeholder="State only what is accurate for your target locations."
                onChange={(value) => updateProfile("workAuthorization", value)}
              />
              <TextAreaField
                id="availability"
                label="Availability"
                value={profile.availability}
                maxLength={500}
                rows={3}
                placeholder="For example: available after four weeks' notice."
                onChange={(value) => updateProfile("availability", value)}
              />
            </div>
          </ProfileSection>

          <ProfileSection
            category={PROFILE_CATEGORY_OPTIONS[4]}
            title="What should never be claimed?"
            description="Add topics, credentials, metrics, or responsibilities the generator must not imply."
            pending={profilePending}
            notice={
              profileNotice?.categoryId === "boundaries" ? profileNotice : null
            }
            onSubmit={submitProfile(PROFILE_CATEGORY_OPTIONS[4])}
          >
            <ListField
              id="excluded-claims"
              label="Excluded claims or topics"
              hint="One per line; up to 20"
              value={profile.excludedClaims}
              maxItems={20}
              placeholder={"People management\nFundraising experience"}
              onChange={(value) => updateProfile("excludedClaims", value)}
            />
          </ProfileSection>
        </div>

        <details
          id="evidence"
          className="group scroll-mt-6 rounded-xl border border-border/70 bg-card/75 shadow-[0_18px_55px_rgba(2,4,3,0.16)] backdrop-blur-xl transition-colors open:border-primary/25 open:bg-card"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-base font-semibold text-foreground">
                Evidence library
              </span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                Projects, achievements, leadership, AI usage, and production
                stories that support your claims.
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/35 text-muted-foreground transition group-open:rotate-180 group-open:border-accent/30 group-open:text-accent">
              <ChevronDown className="h-4 w-4" aria-hidden={true} />
            </span>
          </summary>

          <div className="border-t border-border/65 px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Build claims from proof, not keywords
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Capture the challenge, your actions, and the outcome. Confirm
                  a story only when every claim is accurate and defensible.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(editor) || evidence.length >= 25}
                onClick={() =>
                  setEditor({ ...EMPTY_EVIDENCE, sortOrder: evidence.length })
                }
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Plus className="h-4 w-4" aria-hidden={true} />
                Add evidence
              </button>
            </div>

            <div className="mt-5">
              <NoticeMessage notice={evidenceNotice} />
            </div>

            {editor && (
              <EvidenceEditor
                key={editor.id ?? "new"}
                value={editor}
                pending={evidencePending}
                onChange={setEditor}
                onCancel={() => setEditor(null)}
                onSubmit={submitEvidence}
              />
            )}

            <div className="mt-6 grid gap-3">
              {evidence.length === 0 ? (
                <div className="rounded-lg border border-dashed border-accent/22 bg-background/32 p-6">
                  <p className="font-semibold text-white">No evidence yet.</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Start with a measurable achievement or your most difficult
                    technical project. Two confirmed stories unlock generation
                    readiness; five strong achievements create better coverage.
                  </p>
                </div>
              ) : (
                evidence.map((item) => {
                  const option = EVIDENCE_KIND_OPTIONS.find(
                    (entry) => entry.value === item.kind,
                  );
                  return (
                    <article
                      key={item.id}
                      className="rounded-lg border border-accent/13 bg-background/42 p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <button
                          type="button"
                          onClick={() => setEditor(item)}
                          className="min-w-0 text-left"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs uppercase tracking-[0.14em] text-accent/58">
                              {option?.label ?? item.kind}
                            </span>
                            <EvidenceStatus confirmed={item.confirmed} />
                          </div>
                          <h3 className="mt-2 text-base font-semibold text-white">
                            {item.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {item.outcome || item.actions}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditor(item)}
                            className="rounded-lg border border-accent/14 px-3 py-2 text-xs font-semibold text-white hover:bg-accent/10"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${item.title}`}
                            disabled={evidencePending}
                            onClick={() => removeEvidence(item)}
                            className="rounded-lg border border-rose-300/20 p-2 text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden={true} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </details>
      </div>

      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <div className="rounded-xl border border-accent/18 bg-background/58 p-5 shadow-[0_24px_70px_rgba(2,4,3,0.3)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent/60">
                Application readiness
              </p>
              <p className="mt-2 text-4xl font-bold text-white">
                {readiness.completionPercent}%
              </p>
            </div>
            {readiness.ready ? (
              <CheckCircle2
                className="h-6 w-6 text-accent"
                aria-label="Ready"
              />
            ) : (
              <CircleAlert
                className="h-6 w-6 text-amber-200"
                aria-label="Not ready"
              />
            )}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent/78 transition-[width]"
              style={{ width: `${readiness.completionPercent}%` }}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {readiness.ready
              ? "Your profile meets the minimum evidence threshold for grounded application answers."
              : "Complete the essentials before generating application answers."}
          </p>

          {readiness.missingRequired.length > 0 && (
            <ReadinessList
              title="Required"
              items={readiness.missingRequired}
              tone="required"
            />
          )}
          {readiness.recommendedNext.length > 0 && (
            <ReadinessList
              title="Strengthen next"
              items={readiness.recommendedNext}
              tone="recommended"
            />
          )}

          <div className="mt-5 rounded-lg border border-accent/12 bg-accent/7 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Grounding contract
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Aletheia may select and rephrase confirmed facts. It must not
              create metrics, employers, projects, or experience you did not
              provide.
            </p>
          </div>

          <a
            href="#evidence"
            className="mt-4 flex items-center justify-between text-sm font-semibold text-accent hover:text-white"
          >
            Review evidence
            <ChevronRight className="h-4 w-4" aria-hidden={true} />
          </a>
        </div>
      </aside>
    </div>
  );
}

function ProfileSection({
  category,
  title,
  description,
  defaultOpen = false,
  pending,
  notice,
  onSubmit,
  children,
}: {
  category: ProfileCategoryOption;
  title: string;
  description: string;
  defaultOpen?: boolean;
  pending: boolean;
  notice: Notice;
  onSubmit: (_event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      id={`candidate-${category.id}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group scroll-mt-6 rounded-xl border border-border/70 bg-card/75 shadow-[0_18px_55px_rgba(2,4,3,0.16)] backdrop-blur-xl transition-colors open:border-primary/25 open:bg-card"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 marker:content-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold text-foreground">
            {category.label}
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {category.description}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background/35 text-muted-foreground transition group-open:rotate-180 group-open:border-accent/30 group-open:text-accent">
          <ChevronDown className="h-4 w-4" aria-hidden={true} />
        </span>
      </summary>

      <form
        onSubmit={onSubmit}
        className="border-t border-border/65 px-5 py-6 sm:px-6"
      >
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 space-y-5">{children}</div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Save className="h-4 w-4" aria-hidden={true} />
            {pending ? "Saving…" : category.saveLabel}
          </button>
          <NoticeMessage notice={notice} />
        </div>
      </form>
    </details>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  type = "text",
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  type?: "text" | "url";
  onChange: (_value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-white">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  rows,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  rows: number;
  onChange: (_value: string) => void;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-white">
          {label}
        </label>
        <span className="text-[11px] text-muted-foreground">
          {value.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} resize-y leading-6`}
      />
    </div>
  );
}

function ListField({
  id,
  label,
  hint,
  value,
  maxItems,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string[];
  maxItems: number;
  placeholder: string;
  onChange: (_value: string[]) => void;
}) {
  const [draft, setDraft] = useState(formatListInput(value));

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-white">
          {label}
        </label>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <textarea
        id={id}
        value={draft}
        rows={3}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseListInput(event.target.value, maxItems));
        }}
        className={`${inputClass} resize-y leading-6`}
      />
    </div>
  );
}

function EvidenceEditor({
  value,
  pending,
  onChange,
  onCancel,
  onSubmit,
}: {
  value: CandidateEvidenceInput;
  pending: boolean;
  onChange: (_value: CandidateEvidenceInput) => void;
  onCancel: () => void;
  onSubmit: (_event: React.FormEvent) => void;
}) {
  const update = <Key extends keyof CandidateEvidenceInput>(
    key: Key,
    next: CandidateEvidenceInput[Key],
  ) => onChange({ ...value, [key]: next });

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-xl border border-accent/22 bg-background/55 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {value.id ? "Edit evidence story" : "New evidence story"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Specific actions and verifiable outcomes are more useful than a
            polished summary.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close evidence editor"
          onClick={onCancel}
          className="rounded-lg border border-accent/12 p-2 text-muted-foreground hover:bg-accent/10"
        >
          <X className="h-4 w-4" aria-hidden={true} />
        </button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <label
            htmlFor="evidence-kind"
            className="text-sm font-semibold text-white"
          >
            Evidence type
          </label>
          <select
            id="evidence-kind"
            value={value.kind}
            onChange={(event) =>
              update(
                "kind",
                event.target.value as CandidateEvidenceInput["kind"],
              )
            }
            className={inputClass}
          >
            {EVIDENCE_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {
              EVIDENCE_KIND_OPTIONS.find(
                (option) => option.value === value.kind,
              )?.prompt
            }
          </p>
        </div>
        <TextField
          id="evidence-title"
          label="Short title"
          value={value.title}
          maxLength={160}
          placeholder="Reduced release time from hours to minutes"
          onChange={(next) => update("title", next)}
        />
      </div>

      <div className="mt-5 grid gap-5">
        <TextAreaField
          id="evidence-context"
          label="Challenge and context"
          value={value.context}
          maxLength={1000}
          rows={3}
          placeholder="What was difficult, constrained, unclear, or at risk?"
          onChange={(next) => update("context", next)}
        />
        <TextAreaField
          id="evidence-actions"
          label="What you personally did"
          value={value.actions}
          maxLength={2000}
          rows={5}
          placeholder="Describe your decisions, implementation, collaboration, and verification."
          onChange={(next) => update("actions", next)}
        />
        <TextAreaField
          id="evidence-outcome"
          label="Outcome"
          value={value.outcome}
          maxLength={1200}
          rows={3}
          placeholder="What changed for users, the system, or the business?"
          onChange={(next) => update("outcome", next)}
        />
        <div className="grid gap-5 md:grid-cols-3">
          <ListField
            id="evidence-metrics"
            label="Metrics"
            hint="Up to 8"
            value={value.metrics}
            maxItems={8}
            placeholder={"Only verified numbers\nHours to minutes"}
            onChange={(next) => update("metrics", next)}
          />
          <ListField
            id="evidence-skills"
            label="Skills and tools"
            hint="Up to 20"
            value={value.skills}
            maxItems={20}
            placeholder={"System design\nCI/CD"}
            onChange={(next) => update("skills", next)}
          />
          <ListField
            id="evidence-links"
            label="Proof links"
            hint="Up to 5"
            value={value.links}
            maxItems={5}
            placeholder="https://github.com/..."
            onChange={(next) => update("links", next)}
          />
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-accent/14 bg-accent/7 p-4">
        <input
          type="checkbox"
          checked={value.confirmed}
          onChange={(event) => update("confirmed", event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#285D49]"
        />
        <span>
          <span className="block text-sm font-semibold text-white">
            Confirm this evidence is accurate
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Every claim, metric, link, and description can be defended in an
            interview. Unconfirmed stories remain saved but do not count toward
            generation readiness.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-[background-color,opacity] hover:bg-[#367960] disabled:opacity-55"
        >
          <Save className="h-4 w-4" aria-hidden={true} />
          {pending ? "Saving…" : "Save evidence"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-accent/16 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EvidenceStatus({ confirmed }: { confirmed: boolean }) {
  return confirmed ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
      <CheckCircle2 className="h-3 w-3" aria-hidden={true} /> Confirmed
    </span>
  ) : (
    <span className="rounded-full border border-amber-200/20 bg-amber-200/8 px-2 py-0.5 text-[11px] text-amber-100">
      Unconfirmed
    </span>
  );
}

function NoticeMessage({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.type === "error" ? "alert" : "status"}
      className={`text-sm ${
        notice.type === "error" ? "text-rose-200" : "text-accent"
      }`}
    >
      {notice.message}
    </p>
  );
}

function ReadinessList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "required" | "recommended";
}) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent/58">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "required" ? "bg-amber-200" : "bg-accent/65"
              }`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
