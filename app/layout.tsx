import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://lernu.cc";

export const metadata: Metadata = {
  title: {
    default: "Learn Everything — lernu.cc",
    template: "%s | Learn Everything",
  },
  description:
    "Learn Everything is a hub of focused learning projects: languages, music, and sciences. Pick a path and start learning.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    siteName: "Learn Everything",
    title: "Learn Everything — lernu.cc",
    description:
      "A hub of focused learning projects: languages, music, and sciences. Pick a path and start learning.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Learn Everything — lernu.cc",
    description:
      "A hub of focused learning projects: languages, music, and sciences. Pick a path and start learning.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
