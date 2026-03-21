/**
 * Application configuration constants
 * Centralize magic numbers and configuration values
 */

// Auto-save
export const AUTO_SAVE_CONFIG = {
  INTERVAL_MS: 30000, // 30 seconds
  DEBOUNCE_MS: 1000, // 1 second debounce
} as const;

// Rate limiting
export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 1000, // requests per window (increased for polling endpoints)
  MAX_REQUESTS_STRICT: 10, // for sensitive endpoints (auto-grading, etc.)
} as const;

// Pagination
export const PAGINATION_CONFIG = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

// Worker/Job processing
export const WORKER_CONFIG = {
  CONCURRENCY: 1, // Process one job at a time
  POLL_INTERVAL_MS: 1000, // Check queue every second
  MAX_ATTEMPTS: 3, // Retry failed jobs up to 3 times
} as const;

// AI/LLM
export const AI_CONFIG = {
  DEFAULT_TIMEOUT_MS: 60000, // 60 seconds
  ESTIMATED_TOKENS_PER_GRADING: 1000,
  MAX_RETRIES: 3, // Retry transient LLM errors (429, 5xx)
  BASE_DELAY_MS: 2000, // Exponential backoff base: 2s, 4s, 8s
} as const;

// Session/Auth
export const AUTH_CONFIG = {
  SESSION_REFRESH_INTERVAL_MS: 5 * 60 * 1000, // Refresh session every 5 minutes
  SESSION_WARNING_THRESHOLD_MS: 10 * 60 * 1000, // Warn when 10 minutes left
} as const;

// Notifications
export const NOTIFICATION_CONFIG = {
  POLL_INTERVAL_MS: 30000, // Poll for new notifications every 30 seconds
  MAX_UNREAD_DISPLAY: 99, // Show "99+" for unread count
} as const;
