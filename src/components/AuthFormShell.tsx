"use client";

import type { ReactNode } from "react";
import { VStack } from "@goddonebianu/design-system/stack";

export interface AuthFormShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Centered max-width column with a translated heading. Used by all five
 * auth pages (login / signup / forgot-password / reset-password / logout).
 * Ported from learn-languages' src/components/ui/AuthFormShell.tsx.
 */
export function AuthFormShell({ title, children }: AuthFormShellProps) {
  return (
    <div className="w-full max-w-sm">
      <VStack gap={4} align="center" justify="center">
        <h1 className="w-full text-center text-3xl font-bold text-foreground">{title}</h1>
        {children}
      </VStack>
    </div>
  );
}
