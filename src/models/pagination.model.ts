export type SortDir = 'asc' | 'desc';

export interface PaginationQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir: SortDir;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
