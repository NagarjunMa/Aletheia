import { SUPPORT_EMAIL } from "@/lib/public-contact";

export function buildFeedbackMailto(name: string, message: string): string {
  const normalizedName = name.trim().replace(/\s+/gu, " ");
  const body = normalizedName
    ? `Name: ${normalizedName}\n\n${message.trim()}`
    : message.trim();

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Aletheia product feedback")}&body=${encodeURIComponent(body)}`;
}
