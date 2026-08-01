/**
 * SSO redirect guard for the lernu.cc auth host.
 *
 * learn-languages' `getSafeRedirectPath` (src/lib/safe-redirect.ts) only
 * accepts same-origin relative paths and rejects every absolute URL —
 * which would break the SSO flow, where lang/together redirect
 * unauthenticated users to `https://lernu.cc/login?redirect=https://lang.lernu.cc/decks`
 * and expect the host to send them back after sign-in.
 *
 * This guard opens that one door safely:
 *   - same-origin relative paths (`/decks`, `/profile`) pass through
 *   - absolute URLs whose origin is one of the three trusted lernu.cc
 *     subdomains (lernu.cc / lang.lernu.cc / room.lernu.cc) pass
 *     through with their path/query/hash preserved
 *   - everything else (e.g. `https://evil.com`, `//evil.com`, `/\evil.com`,
 *     `javascript:...`) returns null, defeating open-redirect attacks
 *
 * Always use this on the consumption side (before `router.push(target)` /
 * `window.location.href = target` / `redirect(target)`).
 */

const ALLOWED_SSO_ORIGINS = new Set<string>([
  "https://lernu.cc",
  "https://lang.lernu.cc",
  "https://room.lernu.cc",
]);

/**
 * Returns a safe redirect target (relative path OR an absolute URL on a
 * whitelisted lernu.cc subdomain), or null if the input is unsafe.
 */
export function getSafeSubdomainRedirectPath(target: string | null | undefined): string | null {
  if (!target) return null;

  const trimmed = target.trim();
  if (!trimmed) return null;

  // ── Relative path branch ──────────────────────────────────────────────
  // Must start with "/" but not "//" or "/\" (protocol-relative / backslash
  // variants that browsers resolve against the current origin).
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return null;
    try {
      const decoded = decodeURIComponent(trimmed);
      if (!decoded.startsWith("/")) return null;
      if (decoded.startsWith("//") || decoded.startsWith("/\\")) return null;
    } catch {
      return null;
    }
    return trimmed;
  }

  // ── Absolute URL branch ───────────────────────────────────────────────
  // Parse and match origin against the SSO whitelist. `new URL` rejects
  // bare hosts ("evil.com") and non-URL inputs; only true absolute URLs with
  // a scheme parse. We then confirm the scheme is https and the host is one
  // of our subdomains (exact match — no wildcard, no port, no userinfo).
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (!ALLOWED_SSO_ORIGINS.has(url.origin)) return null;

  // Reject embedded userinfo (https://user@host) — origin already includes
  // none for these hosts, but be defensive against future URL parser quirks.
  if (url.username || url.password) return null;

  // Rebuild from the trusted origin + the parsed pathname/search/hash so a
  // sneaky second origin can't sneak through via the path.
  const safe = url.origin + url.pathname + url.search + url.hash;
  return safe;
}
