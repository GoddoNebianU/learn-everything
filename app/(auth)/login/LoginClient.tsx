"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { getSafeSubdomainRedirectPath } from "@/lib/safe-subdomain-redirect";
import { navigateToSafeRedirect } from "@/lib/navigate-safe-redirect";
import { Input } from "@goddonebianu/design-system/input";
import { Button } from "@goddonebianu/design-system/button";
import { VStack } from "@goddonebianu/design-system/stack";
import { AuthFormShell } from "@/components/AuthFormShell";

const DEFAULT_REDIRECT = "/";

export function LoginClient() {
  const t = useTranslations("auth");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const searchParams = useSearchParams();
  const redirectTo = getSafeSubdomainRedirectPath(searchParams.get("redirect"));

  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session?.user?.username && !redirectTo) {
      router.push(DEFAULT_REDIRECT);
    }
  }, [session, isPending, router, redirectTo]);

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL: DEFAULT_REDIRECT,
      });
      if (error) {
        toast.error(t("resendFailed"));
      } else {
        toast.success(t("resendSuccess"));
        setShowResendOption(false);
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username) {
      toast.error(t("identifierRequired"));
      return;
    }
    if (!password) {
      toast.error(t("passwordRequired"));
      return;
    }

    setLoading(true);
    setShowResendOption(false);
    try {
      if (username.includes("@")) {
        const { error } = await authClient.signIn.email({
          email: username,
          password: password,
        });
        if (error) {
          if (error.status === 403) {
            setUnverifiedEmail(username);
            setShowResendOption(true);
            toast.error(t("emailNotVerified"));
          } else {
            toast.error(t("loginFailed"));
          }
          return;
        }
      } else {
        const { error } = await authClient.signIn.username({
          username: username,
          password: password,
        });
        if (error) {
          if (error.status === 403) {
            toast.error(t("emailNotVerified"));
          } else {
            toast.error(t("loginFailed"));
          }
          return;
        }
      }
      navigateToSafeRedirect(redirectTo ?? DEFAULT_REDIRECT, router);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormShell title={t("title")}>
      <VStack gap={2} align="stretch" justify="center" className="w-full">
        <Input
          placeholder={t("usernameOrEmailPlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </VStack>

      <Link
        href="/forgot-password"
        className="self-end text-sm text-muted-foreground hover:text-primary-500"
      >
        {t("forgotPassword")}
      </Link>

      {showResendOption && (
        <div className="w-full rounded-lg bg-yellow-50 p-3 text-sm">
          <p className="mb-2 text-yellow-800">{t("emailNotVerifiedHint")}</p>
          <Button
            variant="link"
            onClick={handleResendVerification}
            loading={resendLoading}
            className="text-sm"
          >
            {t("resendVerification")}
          </Button>
        </div>
      )}

      <Button variant="default" onClick={handleLogin} loading={loading} fullWidth>
        {t("confirm")}
      </Button>

      <Link
        href={"/signup" + (redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "")}
        className="text-center text-primary-500 hover:underline"
      >
        {t("noAccountLink")}
      </Link>
    </AuthFormShell>
  );
}
