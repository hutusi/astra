"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/parent", key: "dashboard", emoji: "🏠" },
  { href: "/parent/rewards", key: "rewards", emoji: "🎁" },
  { href: "/parent/settings", key: "settings", emoji: "⚙️" },
] as const;

export function ParentNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t bg-background pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active =
          tab.href === "/parent"
            ? pathname === "/parent" || pathname.startsWith("/parent/children")
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            <span className="text-lg">{tab.emoji}</span>
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
