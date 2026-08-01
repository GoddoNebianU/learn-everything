"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@goddonebianu/design-system/dropdown-menu";
import { navbarIconButtonClassName } from "@goddonebianu/design-system/navbar";

const languages = [
  { code: "en-US", label: "English" },
  { code: "zh-CN", label: "中文" },
  { code: "ug-CN", label: "ئۇيغۇرچە" },
  { code: "eo", label: "Esperanto" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "it-IT", label: "Italiano" },
  { code: "de-DE", label: "Deutsch" },
];

export function LanguageSettings() {
  const t = useTranslations("common");
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  useEffect(() => {
    if (pendingLocale) {
      document.cookie = `locale=${pendingLocale}; path=/; max-age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
      window.location.reload();
    }
  }, [pendingLocale]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={navbarIconButtonClassName}
          aria-label={t("switchLanguage")}
        >
          <Languages size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => setPendingLocale(lang.code)}>
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
