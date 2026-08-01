import { Suspense } from "react";
import { Spinner } from "@goddonebianu/design-system/spinner";
import { LoginClient } from "./LoginClient";

// learn-everything is the always-open auth host — there is no capability gate
// (unlike learn-languages' `hasCapability("signup")` 404 guard). Suspense is
// required because LoginClient reads `useSearchParams` (Next.js 16 PPR rule).
export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginClient />
    </Suspense>
  );
}
