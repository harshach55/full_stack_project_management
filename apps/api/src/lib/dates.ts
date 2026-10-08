/**
 * Date-only values (YYYY-MM-DD) are stored in PostgreSQL DATE columns.
 * They are converted at UTC midnight and never through local time, so the
 * calendar date cannot shift by a day (PD-03).
 */
export function toDbDate(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromDbDate(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10);
}

export function toTimestamp(value: Date): string {
  return value.toISOString();
}
