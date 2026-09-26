// Local extension storage is shared by every account using this browser profile.
// Records without an owner predate account isolation and must not be reused.
export function isOwnedRecord(record, ownerId) {
  return Boolean(ownerId && record?.ownerId === ownerId);
}

export function isMatchingAccountToken(requesterId, accessToken, auth) {
  return Boolean(
    requesterId &&
    accessToken &&
    auth?.user?.id === requesterId &&
    auth.access_token === accessToken,
  );
}

export function getOwnedUsage(usage, usageOwnerId, ownerId) {
  return ownerId &&
    usageOwnerId === ownerId &&
    usage &&
    typeof usage === "object"
    ? usage
    : {};
}

export function filterOwnedAccepted(accepted, category, ownerId, limit = 3) {
  if (!Array.isArray(accepted) || !ownerId) return [];
  return accepted
    .filter(
      (item) => isOwnedRecord(item, ownerId) && item.category === category,
    )
    .map((item) => item.body || item.message)
    .filter((body) => typeof body === "string" && body.length > 0)
    .slice(-limit);
}
