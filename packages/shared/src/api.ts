export const ERROR_CODES = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  EMAIL_NOT_VERIFIED: 403,
  FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_MOVE: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  STORAGE_QUOTA_EXCEEDED: 413,
  /** Blocked by an organization policy set in the admin console. */
  POLICY_VIOLATION: 403,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
