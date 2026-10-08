const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a date-only value (YYYY-MM-DD) without any timezone conversion, so the calendar
 * day shown is always the stored one (PD-03).
 */
export function formatDate(value: string | null): string {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return `${MONTHS[month - 1] ?? ''} ${day}, ${year}`;
}

/** Formats an ISO timestamp (createdAt, updatedAt) as a calendar date in UTC. */
export function formatTimestamp(value: string): string {
  return formatDate(value.slice(0, 10));
}
