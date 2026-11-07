import type { Prisma } from '@prisma/client';

/**
 * Shared full-text style filter for user listings (students, teachers,
 * system users): matches name/email case-insensitively and phone by substring.
 * Returns an empty filter when no search term is supplied.
 */
export function buildUserSearchFilter(
  search: string | undefined,
): Prisma.UserWhereInput {
  const term = search?.trim();
  if (!term) {
    return {};
  }
  return {
    OR: [
      { fullName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
    ],
  };
}
