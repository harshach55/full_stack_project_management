import { z } from 'zod';
import { LIMITS } from './limits.js';

/**
 * Length of a string in UTF-8 bytes (bcrypt limits are byte based).
 * Computed directly so the package needs no platform-specific globals.
 * A lone surrogate counts as 3 bytes, the size of the replacement character it is encoded as.
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint < 0x80) bytes += 1;
    else if (codePoint < 0x800) bytes += 2;
    else if (codePoint < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** True for a real calendar date written as YYYY-MM-DD (years 0001 to 9999). */
export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** Message for a missing required key, otherwise the given message for a wrong type. */
function requiredOr(missingMessage: string, wrongTypeMessage: string) {
  return (issue: { input?: unknown }) => (issue.input === undefined ? missingMessage : wrongTypeMessage);
}

export const DATE_MESSAGE = 'Enter a valid date (YYYY-MM-DD).';

/** Date-only value. Missing keys are reported by the caller's schema (optional or nullable). */
export const dateStringSchema = z
  .string({ error: requiredOr('Date is required (use null for no date).', DATE_MESSAGE) })
  .refine(isValidDateString, { error: DATE_MESSAGE });

export const idSchema = z
  .string({ error: requiredOr('Id is required.', 'Invalid id.') })
  .pipe(z.uuid({ error: 'Invalid id.' }))
  .transform((value) => value.toLowerCase());

export const nameSchema = z
  .string({ error: requiredOr('Name is required.', 'Name must be a string.') })
  .trim()
  .min(1, { error: 'Name is required.' })
  .max(LIMITS.nameMax, { error: `Name must be at most ${LIMITS.nameMax} characters.` });

/** Optional description: trimmed; an empty value is stored as null. */
export const descriptionSchema = z
  .string({
    error: requiredOr('Description is required (use null for no description).', 'Description must be a string.'),
  })
  .trim()
  .max(LIMITS.descriptionMax, { error: `Description must be at most ${LIMITS.descriptionMax} characters.` })
  .nullable()
  .transform((value) => (value === '' ? null : value));

export const fullNameSchema = z
  .string({ error: requiredOr('Full name is required.', 'Full name must be a string.') })
  .trim()
  .min(1, { error: 'Full name is required.' })
  .max(LIMITS.fullNameMax, { error: `Full name must be at most ${LIMITS.fullNameMax} characters.` });

export const emailSchema = z
  .string({ error: requiredOr('Email is required.', 'Enter a valid email address.') })
  .trim()
  .toLowerCase()
  .max(LIMITS.emailMax, { error: `Email must be at most ${LIMITS.emailMax} characters.` })
  .pipe(z.email({ error: 'Enter a valid email address.' }));

/** Search text from a query string: trimmed; empty means "no search". */
export const searchSchema = z
  .string({ error: 'Search must be a single text value.' })
  .trim()
  .max(LIMITS.searchMax, { error: `Search must be at most ${LIMITS.searchMax} characters.` })
  .transform((value) => (value === '' ? undefined : value));
