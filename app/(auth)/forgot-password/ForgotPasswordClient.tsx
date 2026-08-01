"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Input } from "@goddonebianu/design-system/input";
import { Button } from "@goddonebianu/design-system/button";
import { VStack } from "@goddonebianu/design-system/stack";
import { AuthFormShell } from "@/components/AuthFormShell";
import { actionRequestPasswordReset } from "@/modules/auth/forgot-password-action";

export function ForgotPasswordClient() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetRequest = async () => {
    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }

    setLoading(true);
    try {
      const result = await actionRequestPasswordReset({ email });
      if (!result.success) {
        toast.error(result.message);
      } else {
        setSent(true);
        toast.success(t("resetPasswordEmailSentHint"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthFormShell title={t("checkYourEmail")}>
        <p className="text-center text-muted-foreground">{t("resetPasswordEmailSentHint")}</p>
        <Link href="/login" className="text-primary-500 hover:underline">
          {t("backToLogin")}
        </Link>
      </AuthFormShell>
    );
  }

  return (
    <AuthFormShell title={t("forgotPassword")}>
      <p className="text-center text-sm text-muted-foreground">{t("forgotPasswordHint")}</p>
      <VStack gap={2} align="stretch" justify="center" className="w-full">
        <Input
          type="email"
          placeholder={t("emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </VStack>
      <Button variant="default" onClick={handleResetRequest} loading={loading} fullWidth>
        {t("sendResetEmail")}
      </Button>
      <Link href="/login" className="text-center text-primary-500 hover:underline">
        {t("backToLogin")}
      </Link>
    </AuthFormShell>
  );
}
