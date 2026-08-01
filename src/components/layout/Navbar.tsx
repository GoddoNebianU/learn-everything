import { NavbarBar, navLinkClassName } from "@goddonebianu/design-system/navbar";
import Link from "next/link";
import { Home, Settings, User } from "lucide-react";
import { LanguageSettings } from "./LanguageSettings";
import { UserLink, MobileMenuSession } from "./NavSession";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export interface NavigationItem {
  label: string;
  href: string;
  icon?: ReactNode;
}

export async function Navbar() {
  const t = await getTranslations("navbar");
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const isLoggedIn = !!session;

  const loggedInMobileItems: NavigationItem[] = [
    { label: t("settings"), href: "/settings", icon: <Settings size={18} /> },
    { label: t("profile"), href: "/profile", icon: <User size={18} /> },
  ];

  const loggedOutMobileItems: NavigationItem[] = [
    { label: t("sign_in"), href: "/login", icon: <User size={18} /> },
  ];

  return (
    <NavbarBar>
      <Link href="/" className={`${navLinkClassName} hidden! border-b md:block!`}>
        {t("title")}
      </Link>
      <Link href="/" className={`${navLinkClassName} block! md:hidden!`}>
        <Home size={20} />
      </Link>
      <div className="flex items-center justify-center gap-0.5">
        <LanguageSettings />
        <UserLink
          profileLabel={t("profile")}
          signInLabel={t("sign_in")}
          initialSession={isLoggedIn}
        />
        <div className="md:hidden!">
          <MobileMenuSession
            loggedInItems={loggedInMobileItems}
            loggedOutItems={loggedOutMobileItems}
            initialSession={isLoggedIn}
          />
        </div>
      </div>
    </NavbarBar>
  );
}
