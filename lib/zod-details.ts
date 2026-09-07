import type { ZodError } from "zod";

export type ValidationDetail = {
  field: string;
  message: string;
};

export function formatZodDetails(
  error: ZodError,
  fallbackField = "request",
): ValidationDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : fallbackField,
    message: issue.message,
  }));
}
