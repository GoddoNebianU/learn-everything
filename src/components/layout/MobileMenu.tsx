"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@goddonebianu/design-system/dropdown-menu";
import { navbarIconButtonClassName } from "@goddonebianu/design-system/navbar";
import type { NavigationItem } from "./Navbar";

interface MobileMenuProps {
  items: NavigationItem[];
}

export function MobileMenu({ items }: MobileMenuProps) {
  const t = useTranslations("common");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={navbarIconButtonClassName} aria-label={t("openMenu")}>
          <Menu size={24} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item, index) => (
          <DropdownMenuItem key={index} asChild>
            <Link href={item.href}>
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
