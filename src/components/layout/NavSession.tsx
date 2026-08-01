"use client";

import { navLinkClassName } from "@goddonebianu/design-system/navbar";
import Link from "next/link";
import { authClient } from "@/lib/auth/auth-client";
import { MobileMenu } from "./MobileMenu";
import type { NavigationItem } from "./Navbar";

function useIsLoggedIn(initialSession: boolean) {
  const { data: session, isPending } = authClient.useSession();
  return isPending ? initialSession : !!session;
}

interface UserLinkProps {
  profileLabel: string;
  signInLabel: string;
  initialSession: boolean;
}

export function UserLink({ profileLabel, signInLabel, initialSession }: UserLinkProps) {
  const isLoggedIn = useIsLoggedIn(initialSession);

  if (isLoggedIn) {
    return (
      <Link href="/profile" className={`${navLinkClassName} hidden! md:block!`}>
        {profileLabel}
      </Link>
    );
  }

  return (
    <Link href="/login" className={`${navLinkClassName} hidden! md:block!`}>
      {signInLabel}
    </Link>
  );
}

interface MobileMenuSessionProps {
  loggedInItems: NavigationItem[];
  loggedOutItems: NavigationItem[];
  initialSession: boolean;
}

export function MobileMenuSession({
  loggedInItems,
  loggedOutItems,
  initialSession,
}: MobileMenuSessionProps) {
  const isLoggedIn = useIsLoggedIn(initialSession);
  const items = isLoggedIn ? loggedInItems : loggedOutItems;
  return <MobileMenu items={items} />;
}
