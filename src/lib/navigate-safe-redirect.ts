import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Navigate to a redirect target that has ALREADY passed through
 * `getSafeSubdomainRedirectPath`. Same-origin relative targets use the
 * Next.js client router; absolute URLs (a whitelisted *.lernu.cc subdomain)
 * require a full browser navigation, so we drop down to
 * `window.location.href`.
 *
 * Used by the auth pages after a successful sign-in / sign-up / reset so the
 * SSO round-trip — lang.lernu.cc → lernu.cc/login → back to lang.lernu.cc —
 * works for both same-host and cross-subdomain redirects.
 */
export function navigateToSafeRedirect(target: string, router: AppRouterInstance): void {
  // Absolute URL (https://...) → cross-origin navigation, even if same eTLD+1.
  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }
  router.push(target);
}
