/**
 * Safely extract a human-readable message from an unknown thrown value.
 *
 * Used in catch blocks where the thrown value is typed `unknown` (TS strict)
 * and we want to log or surface a string without leaking internal details.
 */
export function errorMessage(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
