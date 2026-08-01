import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// The auth host is always lernu.cc (the root domain). BETTER_AUTH_URL is set
// there and points to this same Next.js app's /api/auth route. Subdomain
// consumers (lang.lernu.cc, together.lernu.cc) talk to the same host; they
// do NOT spin up their own auth-client pointing elsewhere.
export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL || "",
  plugins: [usernameClient()],
});
