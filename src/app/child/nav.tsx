"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/child", key: "today", emoji: "☀️" },
  { href: "/child/stars", key: "stars", emoji: "⭐" },
  { href: "/child/rewards", key: "rewards", emoji: "🎁" },
  { href: "/child/plan", key: "plan", emoji: "🌌" },
  { href: "/child/review", key: "review", emoji: "📒" },
] as const;

export function ChildNav() {
  const t = useTranslations("childNav");
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t border-white/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {TABS.map((tab) => {
        const active =
          tab.href === "/child"
            ? pathname === "/child"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-white font-medium" : "text-slate-400"
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
