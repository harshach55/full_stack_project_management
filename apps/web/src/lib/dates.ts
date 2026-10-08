const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Formats a date-only value (YYYY-MM-DD) for display. It is read as UTC midnight and
 * formatted in UTC, so the calendar day never shifts with the browser's timezone.
 */
export function formatDate(value: string | null): string {
  if (!value) return '';
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

const timestampFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/** Formats an ISO timestamp (createdAt, updatedAt) as a date in the user's timezone. */
export function formatTimestamp(value: string): string {
  return timestampFormatter.format(new Date(value));
}
