"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@goddonebianu/design-system/dropdown-menu";

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

export function LanguageSwitcher() {
  const locale = useLocale();
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingLocale) return;
    document.cookie = `locale=${pendingLocale}; path=/; max-age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
    window.location.reload();
  }, [pendingLocale]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Switch language"
        >
          <Languages size={20} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {languages.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => setPendingLocale(lang.code)}>
            <span className="flex-1">{lang.label}</span>
            {lang.code === locale ? <Check size={16} className="text-primary-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
