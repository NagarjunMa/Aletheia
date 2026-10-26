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
  unavailable?: boolean;
  reservationId?: string;
};

export type AttemptAdmissionResult =
  | { allowed: true; attemptId: string }
  | { allowed: false; unavailable: true }
  | {
      allowed: false;
      unavailable: false;
      code:
        | "GENERATION_IN_PROGRESS"
        | "SHORT_WINDOW_LIMIT_REACHED"
        | "WORK_BUDGET_REACHED";
      retryTime: number;
    };

export type ReservedCredit = {
  userId: string;
  reservationId: string;
  amount: number;
};

export type ResumeSource =
  "user_resumes" | "profiles" | "legacy_payload" | "none";
