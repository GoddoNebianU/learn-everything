"use server";

import { cookies } from "next/headers";
import { SUPPORTED_LOCALES } from "@/config/i18n";

export async function setLocale(locale: string): Promise<void> {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
