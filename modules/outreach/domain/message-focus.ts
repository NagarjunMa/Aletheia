import { z } from "zod";

// JavaScript string length: UTF-16 code units, matching the future popup counter.
export const MESSAGE_FOCUS_MAX_LENGTH = 500;

// ALE-63 is contract-only. An environment flag cannot enable an unimplemented
// selection/generation pipeline. Stage 3 must explicitly replace this gate.
export const MESSAGE_FOCUS_SUPPORTED = false;

export const messageFocusSchema = z
  .string()
  // Bound work before normalization; whitespace cannot hide oversized input.
  .max(MESSAGE_FOCUS_MAX_LENGTH)
  .transform((value) => value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim())
  // NFKC may expand a short input, e.g. ligatures become multiple characters.
  .pipe(z.string().max(MESSAGE_FOCUS_MAX_LENGTH))
  .transform((value) => value || undefined)
  .optional();
