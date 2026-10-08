/**
 * Prisma's `contains` filter is translated to LIKE/ILIKE without escaping the
 * pattern characters, so "_" would match any character and "%" anything. Search
 * terms must match literally (api-contract.md, section 4), so they are escaped
 * here with PostgreSQL's default LIKE escape character, the backslash.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive partial name match for an optional search term. */
export function nameContains(search: string | undefined) {
  return search ? { name: { contains: escapeLikePattern(search), mode: 'insensitive' as const } } : {};
}
