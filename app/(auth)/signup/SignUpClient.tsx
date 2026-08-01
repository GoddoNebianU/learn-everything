"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { getSafeSubdomainRedirectPath } from "@/lib/safe-subdomain-redirect";
import { Input } from "@goddonebianu/design-system/input";
import { Button } from "@goddonebianu/design-system/button";
import { VStack } from "@goddonebianu/design-system/stack";
import { AuthFormShell } from "@/components/AuthFormShell";

const DEFAULT_REDIRECT = "/";

export function SignUpClient() {
  const t = useTranslations("auth");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const searchParams = useSearchParams();
  const redirectTo = getSafeSubdomainRedirectPath(searchParams.get("redirect"));

  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session?.user?.username && !redirectTo) {
      router.push(DEFAULT_REDIRECT);
    }
  }, [session, isPending, router, redirectTo]);

  const [resendLoading, setResendLoading] = useState(false);

  const handleResendVerification = async () => {
    if (!email) return;
    setResendLoading(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email: email,
        callbackURL: DEFAULT_REDIRECT,
      });
      if (error) {
        toast.error(t("resendFailed"));
      } else {
        toast.success(t("resendSuccess"));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !confirmPassword) {
      toast.error(t("fillAllFields"));
      return;
    }
    if (username.length < 3) {
      toast.error(t("usernameTooShort"));
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      toast.error(t("usernameInvalid"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("invalidEmail"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("passwordsNotMatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        email: email,
        name: username,
        username: username,
        password: password,
      });
      if (error) {
        toast.error(t("signUpFailed"));
        return;
      }
      setVerificationSent(true);
      toast.success(t("verificationEmailSent"));
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <AuthFormShell title={t("verifyYourEmail")}>
        <p className="text-center text-muted-foreground">
          {t("verificationEmailSentHint", { email })}
        </p>
        <Link href="/login" className="text-primary-500 hover:underline">
          {t("backToLogin")}
        </Link>
        <Button variant="secondary" onClick={handleResendVerification} loading={resendLoading}>
          {t("resendVerification")}
        </Button>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell title={t("signUpTitle")}>
      <VStack gap={2} align="stretch" justify="center" className="w-full">
        <Input
          placeholder={t("usernamePlaceholder")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </VStack>

      <Button variant="default" onClick={handleSignUp} loading={loading} fullWidth>
        {t("confirm")}
      </Button>

      <Link
        href={"/login" + (redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "")}
        className="text-center text-primary-500 hover:underline"
      >
        {t("hasAccountLink")}
      </Link>
    </AuthFormShell>
  );
}
