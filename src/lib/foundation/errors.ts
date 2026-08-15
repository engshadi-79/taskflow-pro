export class AppError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "validation_error");
    this.name = "ValidationError";
  }
}

export class PermissionError extends AppError {
  constructor(message = "غير مصرح لك بهذا الإجراء") {
    super(message, "permission_error");
    this.name = "PermissionError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "العنصر غير موجود") {
    super(message, "not_found");
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "لقد تجاوزت الحد المسموح، حاول لاحقًا") {
    super(message, "rate_limited");
    this.name = "RateLimitError";
  }
}

/**
 * Every Server Action in this app returns `{ error?: string }` on failure
 * (never throws to the client) - this is the one place that turns any
 * thrown error into that shape, so a new action can do
 * `try { ... } catch (err) { return toActionError(err); }` once instead of
 * hand-writing a fallback message per action.
 */
export function toActionError(err: unknown): { error: string } {
  if (err instanceof AppError) {
    return { error: err.message };
  }
  // Supabase/Postgrest errors already carry a usable .message (often the
  // text of a check constraint written for exactly this purpose) -
  // surfacing it matches how every existing Server Action already
  // handles `{ error }` from a Supabase call.
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    return { error: err.message };
  }
  console.error("Unhandled action error", err);
  return { error: "حدث خطأ غير متوقع، حاول مرة أخرى" };
}
