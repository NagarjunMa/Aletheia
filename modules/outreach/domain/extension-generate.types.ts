export type AuthenticatedExtensionUser = {
  userId: string;
  email: string;
  /** Verified caller credential forwarded only to caller-scoped RLS clients. */
  accessToken: string;
};

export type MessageFocusUnavailableResponse = {
  success: false;
  error: string;
  code: "MESSAGE_FOCUS_UNAVAILABLE";
  message: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
};

export type ReservedCredit = {
  userId: string;
  reservationId: string;
  amount: number;
};

export type ResumeSource =
  "user_resumes" | "profiles" | "legacy_payload" | "none";
