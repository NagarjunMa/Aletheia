export type AuthenticatedExtensionUser = {
  userId: string;
  email: string;
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
  | "user_resumes"
  | "profiles"
  | "legacy_payload"
  | "none";
