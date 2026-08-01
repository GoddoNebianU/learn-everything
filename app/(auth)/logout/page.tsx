import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSafeSubdomainRedirectPath } from "@/lib/safe-subdomain-redirect";
import { recordAuthEvent } from "@/modules/auth-event/auth-event-service";
import { AUTH_EVENT_ACTIONS } from "@/modules/auth-event/auth-event-actions";

/**
 * Server-side sign-out. This MUST run on the lernu.cc host (not a subdomain):
 * better-auth's session cookie is set with `domain=.lernu.cc`, and only the
 * cookie's own domain scope can clear it. learn-languages' signOutAction will
 * redirect here for that reason (see learn-together T14).
 *
 * After sign-out we forward to /login carrying the original `?redirect=` so a
 * half-finished SSO round-trip can resume after re-authentication.
 */
export default async function LogoutPage(props: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const redirectTo = getSafeSubdomainRedirectPath(searchParams.redirect);
  const loginUrl = "/login" + (redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "");

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });

  if (session) {
    await recordAuthEvent({
      userId: session.user.id,
      action: AUTH_EVENT_ACTIONS.LOGOUT,
      entityType: "session",
      entityId: session.session.id,
    });
    await auth.api.signOut({ headers: h });
  }

  redirect(loginUrl);
}
