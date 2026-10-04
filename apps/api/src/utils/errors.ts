import { ERROR_CODES, type ErrorCode } from '@qub/shared';

/** An error that is safe to show to API clients. Anything else becomes a generic 500. */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = ERROR_CODES[code];
  }
}

export const notFound = (what = 'resource') => new AppError('RESOURCE_NOT_FOUND', `The requested ${what} was not found.`);
export const forbidden = (message = 'You do not have permission to perform this action.') => new AppError('FORBIDDEN', message);
export const unauthenticated = (message = 'Authentication is required.') => new AppError('UNAUTHENTICATED', message);
export const badRequest = (message: string, details?: unknown) => new AppError('BAD_REQUEST', message, details);
export const conflict = (message: string, details?: unknown) => new AppError('CONFLICT', message, details);
/** Blocked by an organization policy set in the admin console. */
export const policyViolation = (message: string) => new AppError('POLICY_VIOLATION', message);
export const unprocessable = (message: string, details?: unknown) => new AppError('VALIDATION_ERROR', message, details);
