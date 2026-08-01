import type { ReactNode } from "react";

/**
 * Centered-card layout for the (auth) route group. Mirrors learn-languages'
 * PageLayout variant="centered-card" without needing the full PageLayout
 * primitive (this portal has no lesson/full-width variants to support).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[var(--page-min-h)] items-start justify-center overflow-x-hidden bg-background-secondary px-4 py-10">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
