/** Field limits shared by the API, the web app and the mobile app (scope-and-decisions.md, section 6). */
export const LIMITS = {
  fullNameMax: 100,
  emailMax: 254,
  passwordMinBytes: 8,
  passwordMaxBytes: 72,
  nameMax: 120,
  descriptionMax: 2000,
  searchMax: 120,
} as const;

/** Session lifetime in seconds (7 days, PD-14). */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Name of the httpOnly cookie that holds the web session token. */
export const SESSION_COOKIE_NAME = 'pm_session';

/** Header the mobile app sends on login/register to receive the token in the response body. */
export const CLIENT_TYPE_HEADER = 'X-Client-Type';
export const MOBILE_CLIENT_TYPE = 'mobile';
