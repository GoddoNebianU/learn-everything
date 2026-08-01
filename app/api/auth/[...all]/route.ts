import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// learn-everything is the always-open auth host (no capability/signup gate,
// unlike learn-languages which wrapped these handlers in a `hasCapability`
// 404 guard). SSO triple (crossSubDomainCookies + trustedOrigins + secret)
// lives on the `auth` instance; this route just delegates.
export const { GET, POST } = toNextJsHandler(auth);
