/**
 * Centralized application configuration constants.
 *
 * All "magic numbers" and tunable parameters live here. Environment-dependent
 * values are in src/lib/env.ts.
 */

// ─── Auth: IP Rate Limiting ─────────────────────────────
export const AUTH = {
  /** Max signups per IP address within SIGNUP_WINDOW_MS */
  SIGNUP_MAX_PER_IP: 3,
  /** Signup rate-limit window in milliseconds (24 hours) */
  SIGNUP_WINDOW_MS: 24 * 60 * 60 * 1000,
  /** Max failed login attempts per IP within LOGIN_WINDOW_MS */
  LOGIN_MAX_FAILS: 5,
  /** Login rate-limit window in milliseconds (15 minutes) */
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
} as const;

// ─── IP Limiter ─────────────────────────────────────────
export const IP_LIMITER = {
  /** Trigger sweep (cleanup expired entries) when map exceeds this size */
  SWEEP_THRESHOLD: 500,
} as const;
