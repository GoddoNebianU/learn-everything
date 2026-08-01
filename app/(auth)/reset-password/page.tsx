import { Suspense } from "react";
import { Spinner } from "@goddonebianu/design-system/spinner";
import { ResetPasswordClient } from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
