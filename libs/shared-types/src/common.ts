export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  error?: string;
  correlationId?: string;
}

export interface Money {
  amountMinorUnits: number;
  currency: string;
}
