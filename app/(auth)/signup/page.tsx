import { Suspense } from "react";
import { Spinner } from "@goddonebianu/design-system/spinner";
import { SignUpClient } from "./SignUpClient";

export default function SignUpPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SignUpClient />
    </Suspense>
  );
}
