/**
 * Normalized error model for consistent error handling across the app
 * Maps various error types to standardized categories
 */
export enum ErrorType {
  NETWORK = 'NETWORK', // Network connectivity issues
  UNAUTHORIZED = 'UNAUTHORIZED', // 401 - Invalid/expired token
  FORBIDDEN = 'FORBIDDEN', // 403 - Insufficient permissions
  NOT_FOUND = 'NOT_FOUND', // 404 - Resource not found
  CLIENT_ERROR = 'CLIENT_ERROR', // 4xx - Other client errors
  SERVER_ERROR = 'SERVER_ERROR', // 5xx - Server errors
  TIMEOUT = 'TIMEOUT', // Request timeout
  UNKNOWN = 'UNKNOWN', // Unexpected errors
}

export interface AppError {
  type: ErrorType;
  message: string;
  statusCode?: number;
  originalError?: unknown;
  timestamp: Date;
  requestId?: string; // For tracing in production
  retryAfterMs?: number; // Parsed from a `Retry-After` response header, in milliseconds
}

/**
 * Factory function to create AppError instances
 * Strips sensitive data from errors before logging
 */
export function createAppError(
  type: ErrorType,
  message: string,
  statusCode?: number,
  originalError?: unknown,
  requestId?: string,
  retryAfterMs?: number
): AppError {
  // Strip any sensitive fields from the original error
  const sanitizedError = sanitizeError(originalError);

  return {
    type,
    message,
    statusCode,
    originalError: sanitizedError,
    timestamp: new Date(),
    requestId,
    retryAfterMs,
  };
}

/**
 * Parses an HTTP `Retry-After` header into milliseconds.
 * Supports both the delta-seconds form (e.g. "120") and the HTTP-date form.
 * Returns undefined when the header is absent or unparseable.
 */
export function parseRetryAfter(headerValue: string | null | undefined): number | undefined {
  if (!headerValue) return undefined;

  // delta-seconds form: a non-negative integer number of seconds
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  // HTTP-date form: an absolute timestamp to wait until
  const retryAtMs = Date.parse(headerValue);
  if (!Number.isNaN(retryAtMs)) {
    return Math.max(0, retryAtMs - Date.now());
  }

  return undefined;
}

/**
 * Maps HTTP status codes to error types
 */
export function mapStatusToErrorType(status: number): ErrorType {
  if (status === 401) return ErrorType.UNAUTHORIZED;
  if (status === 403) return ErrorType.FORBIDDEN;
  if (status === 404) return ErrorType.NOT_FOUND;
  if (status >= 400 && status < 500) return ErrorType.CLIENT_ERROR;
  if (status >= 500) return ErrorType.SERVER_ERROR;
  return ErrorType.UNKNOWN;
}

/**
 * Sanitizes error objects to remove sensitive information
 * Never log tokens, passwords, or other PII
 */
function sanitizeError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;

  const sensitiveKeys = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'apiKey',
    'secret',
    'pin',
    'cvv',
    'ssn',
  ];

  const sanitized = { ...error } as Record<string, unknown>;

  // Remove sensitive fields
  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'timestamp' in error
  );
}

/**
 * Gets a user-friendly error message based on error type
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Please check your internet connection and try again.';
    case ErrorType.UNAUTHORIZED:
      return 'Your session has expired. Please log in again.';
    case ErrorType.FORBIDDEN:
      return 'You do not have permission to perform this action.';
    case ErrorType.NOT_FOUND:
      return 'The requested resource could not be found.';
    case ErrorType.TIMEOUT:
      return 'The request took too long. Please try again.';
    case ErrorType.SERVER_ERROR:
      return 'Something went wrong on our end. Please try again later.';
    case ErrorType.CLIENT_ERROR:
    case ErrorType.UNKNOWN:
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}