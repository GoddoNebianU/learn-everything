"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/auth-client";
import { Input } from "@goddonebianu/design-system/input";
import { Button } from "@goddonebianu/design-system/button";
import { VStack } from "@goddonebianu/design-system/stack";
import { AuthFormShell } from "@/components/AuthFormShell";

export function ResetPasswordClient() {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      toast.error(t("fillAllFields"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("passwordsNotMatch"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (!token) {
      toast.error(t("invalidToken"));
      return;
    }

    setLoading(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (error) {
      toast.error(t("resetPasswordFailed"));
    } else {
      setSuccess(true);
      toast.success(t("resetPasswordSuccess"));
      window.setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <AuthFormShell title={t("resetPasswordSuccessTitle")}>
        <p className="text-center text-muted-foreground">{t("resetPasswordSuccessHint")}</p>
        <Link href="/login" className="text-primary-500 hover:underline">
          {t("backToLogin")}
        </Link>
      </AuthFormShell>
    );
  }

  if (!token) {
    return (
      <AuthFormShell title={t("invalidToken")}>
        <p className="text-center text-muted-foreground">{t("invalidTokenHint")}</p>
        <Link href="/forgot-password" className="text-primary-500 hover:underline">
          {t("requestNewToken")}
        </Link>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell title={t("resetPassword")}>
      <VStack gap={2} align="stretch" justify="center" className="w-full">
        <Input
          type="password"
          placeholder={t("newPassword")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder={t("confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </VStack>
      <Button variant="default" onClick={handleResetPassword} loading={loading} fullWidth>
        {t("resetPassword")}
      </Button>
      <Link href="/login" className="text-center text-primary-500 hover:underline">
        {t("backToLogin")}
      </Link>
    </AuthFormShell>
  );
}
