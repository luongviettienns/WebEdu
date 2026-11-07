export interface PaginationInput {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationWindow {
  page: number;
  limit: number;
  skip: number;
}

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalizes untrusted `page`/`limit` query values: page >= 1 and
 * 1 <= limit <= MAX_PAGE_SIZE (server-side cap).
 */
export function resolvePagination(
  query: PaginationInput | undefined,
  defaultLimit: number = DEFAULT_PAGE_SIZE,
): PaginationWindow {
  const page = Math.max(1, Number(query?.page) || 1);
  const limit = Math.max(
    1,
    Math.min(MAX_PAGE_SIZE, Number(query?.limit) || defaultLimit),
  );
  return { page, limit, skip: (page - 1) * limit };
}
