import type { z } from "zod";
import { ValidationError } from "./errors";

/**
 * FormData -> plain object -> zod schema, in one call, replacing the
 * hand-written `if (!x) return { error: "..." }` chains every Server
 * Action wrote individually up to now. Pass a field name in `arrayFields`
 * to collect it via formData.getAll() instead of formData.get() (for
 * repeated checkbox/multi-select inputs like `user_id`).
 */
export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
  arrayFields: string[] = []
): z.infer<T> {
  const raw: Record<string, unknown> = {};

  for (const key of new Set(formData.keys())) {
    if (arrayFields.includes(key)) {
      raw[key] = formData.getAll(key);
    } else {
      const value = formData.get(key);
      // a blank input submits as "" - normalize to undefined so
      // `.optional()`/`.default()` in the schema behave as expected
      raw[key] = value === "" ? undefined : value;
    }
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ValidationError(first?.message ?? "بيانات غير صالحة");
  }
  return result.data;
}
