import type { z } from 'zod';

export type FieldErrors = Record<string, string>;

/**
 * Validates form values with a shared schema (the same one the API uses) and returns the
 * parsed data or the first message per field. The API validates again and is authoritative.
 */
export function validateForm<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { success: true; data: z.output<S> } | { success: false; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path.map(String).join('.') || 'form';
    if (!errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}

/** Text date inputs use "" for an empty value; the API uses null. */
export function dateTextToValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}
