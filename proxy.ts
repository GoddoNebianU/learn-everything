import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/config/i18n";

// Order matters: first prefix match in Accept-Language wins. Uyghur ("ug")
// must be checked before any unrelated two-letter code that could shadow it.
const LOCALE_PREFIXES: ReadonlyArray<{ prefix: string; locale: string }> = [
  { prefix: "ug", locale: "ug-CN" },
  { prefix: "zh", locale: "zh-CN" },
  { prefix: "eo", locale: "eo" },
  { prefix: "fr", locale: "fr-FR" },
  { prefix: "es", locale: "es-ES" },
  { prefix: "it", locale: "it-IT" },
  { prefix: "de", locale: "de-DE" },
];

function detectLocale(acceptLanguage: string): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  for (const part of acceptLanguage.split(",")) {
    const tag = part.trim().toLowerCase();
    for (const { prefix, locale } of LOCALE_PREFIXES) {
      if (tag.startsWith(prefix)) return locale;
    }
  }
  return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get("locale")?.value;
  if (existing && (SUPPORTED_LOCALES as readonly string[]).includes(existing)) {
    return NextResponse.next();
  }

  const detected = detectLocale(request.headers.get("accept-language") ?? "");
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set("locale", detected, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
