/**
 * Standard error response utilities for API endpoints
 */

export type ApiErrorResponse = {
  error: string;
  details?: unknown;
  code?: string;
};

export type ApiSuccessResponse<T = unknown> = {
  data: T;
  message?: string;
};

/**
 * Create a standardized error response
 */
export function errorResponse(message: string, details?: unknown, code?: string): ApiErrorResponse {
  const response: ApiErrorResponse = { error: message };
  if (details !== undefined) {
    response.details = details;
  }
  if (code !== undefined) {
    response.code = code;
  }
  return response;
}

/**
 * Create a standardized success response
 */
export function successResponse<T>(data: T, message?: string): ApiSuccessResponse<T> {
  const response: ApiSuccessResponse<T> = { data };
  if (message !== undefined) {
    response.message = message;
  }
  return response;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;
