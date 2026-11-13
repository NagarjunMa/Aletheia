import { z } from "zod";

// JavaScript string length: UTF-16 code units, matching the future popup counter.
export const MESSAGE_FOCUS_MAX_LENGTH = 500;

export function messageFocusEnabled(): boolean {
  // The current Anthropic SDK logs raw request bodies in wire debug mode.
  return (
    process.env.MESSAGE_FOCUS_ENABLED === "true" && process.env.DEBUG !== "true"
  );
}

export const messageFocusSchema = z
  .string()
  // Bound work before normalization; whitespace cannot hide oversized input.
  .max(MESSAGE_FOCUS_MAX_LENGTH)
  .refine(
    (value) => value.length <= MESSAGE_FOCUS_MAX_LENGTH,
    "Message focus is too long",
  )
  .transform((value) => value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim())
  // NFKC may expand a short input, e.g. ligatures become multiple characters.
  .pipe(z.string().max(MESSAGE_FOCUS_MAX_LENGTH))
  .refine(
    (value) => value.length <= MESSAGE_FOCUS_MAX_LENGTH,
    "Message focus is too long",
  )
  .transform((value) => value || undefined)
  .optional();
