import { IP_LIMITER } from "@/config/app";

/**
 * In-memory IP rate limiter for the auth host.
 *
 * SERVERLESS CAVEAT (Vercel): each serverless instance keeps its own Map, so
 * this is BEST-EFFORT only — an attacker hitting multiple instances bypasses
 * the per-IP cap. On a single warm instance the limits hold normally. A real
 * shared-store limiter (Redis / Upstash) is a separate scope; for now we
 * accept the trade-off to avoid an external dependency.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of attempts) {
    if (now > v.resetAt) attempts.delete(k);
  }
}

export function checkIpLimit(key: string, max: number, windowMs: number): boolean {
  if (attempts.size > IP_LIMITER.SWEEP_THRESHOLD) sweep();
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export function recordFailedIp(key: string, windowMs: number): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now <= entry.resetAt) {
    entry.count++;
  } else {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
  }
}

export function clearIp(key: string): void {
  attempts.delete(key);
}

export function getRequestIp(): Promise<string | null> {
  return import("next/headers")
    .then(async ({ headers }) => {
      try {
        const h = await headers();
        return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
      } catch {
        return null;
      }
    })
    .catch(() => null);
}
