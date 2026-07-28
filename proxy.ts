import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/config/i18n";

function detectLocale(acceptLanguage: string): string {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const hasChinese = acceptLanguage
    .split(",")
    .some((part) => part.trim().toLowerCase().startsWith("zh"));
  return hasChinese ? "zh-CN" : DEFAULT_LOCALE;
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
