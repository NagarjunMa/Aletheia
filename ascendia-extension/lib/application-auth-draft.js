const YC_APPLICATION_CATEGORY = "yc_application";

export const APPLICATION_AUTH_DRAFT_KEY = "applicationAuthDraft";
export const APPLICATION_AUTH_DRAFT_TTL_MS = 15 * 60 * 1000;
export function buildApplicationAuthDraft(
  { category, jd, questions, ownerId = null },
  now = Date.now(),
) {
  if (
    category !== YC_APPLICATION_CATEGORY ||
    typeof jd !== "string" ||
    jd.length > 20000 ||
    typeof questions !== "string" ||
    questions.length > 10000
  )
    return null;
  return {
    category,
    jd,
    questions,
    ownerId,
    expiresAt: now + APPLICATION_AUTH_DRAFT_TTL_MS,
  };
}
export function readApplicationAuthDraft(value, ownerId, now = Date.now()) {
  if (
    !value ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + APPLICATION_AUTH_DRAFT_TTL_MS ||
    (value.ownerId !== null && value.ownerId !== ownerId)
  )
    return null;
  const draft = buildApplicationAuthDraft(value, now);
  return draft ? { ...draft, expiresAt: value.expiresAt } : null;
}

export async function saveApplicationAuthDraft(draft, storage, alarms) {
  if (!draft) return;
  await storage.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  await storage.set({ [APPLICATION_AUTH_DRAFT_KEY]: draft });
  try {
    await alarms.create("application-auth-draft-expiry", {
      when: draft.expiresAt,
    });
  } catch (error) {
    await storage.remove(APPLICATION_AUTH_DRAFT_KEY);
    throw error;
  }
}
