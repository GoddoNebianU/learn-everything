"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@goddonebianu/design-system/button";
import { SUPPORTED_LOCALES } from "@/config/i18n";
import { setLocale } from "@/actions/set-locale";

const LABEL_KEYS: Record<(typeof SUPPORTED_LOCALES)[number], "en" | "zh"> = {
  "en-US": "en",
  "zh-CN": "zh",
};

export function LanguageSwitcher() {
  const locale = useLocale() as (typeof SUPPORTED_LOCALES)[number];
  const router = useRouter();
  const t = useTranslations("langSwitch");
  const [, startTransition] = useTransition();

  const switchTo = async (next: (typeof SUPPORTED_LOCALES)[number]) => {
    if (next === locale) return;
    await setLocale(next);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      {SUPPORTED_LOCALES.map((code) => (
        <Button
          key={code}
          variant="ghost"
          size="sm"
          selected={locale === code}
          onClick={() => void switchTo(code)}
          aria-pressed={locale === code}
        >
          {t(LABEL_KEYS[code])}
        </Button>
      ))}
    </div>
  );
}
