"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const TABS = [
  { href: "/child", key: "today", emoji: "☀️" },
  { href: "/child/stars", key: "stars", emoji: "⭐" },
  { href: "/child/rewards", key: "rewards", emoji: "🎁" },
  { href: "/child/plan", key: "plan", emoji: "🌌" },
  { href: "/child/review", key: "review", emoji: "📒" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/child" ? pathname === "/child" : pathname.startsWith(href);
}

/** Phone shell: sticky bottom tab bar. Hidden on md+. */
export function ChildNav() {
  const t = useTranslations("childNav");
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t border-white/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
            isActive(pathname, tab.href)
              ? "text-white font-medium"
              : "text-slate-400"
          }`}
        >
          <span className="text-lg">{tab.emoji}</span>
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop shell: playful pill tabs across the top of the sky. md+ only. */
export function ChildTopNav() {
  const t = useTranslations("childNav");
  const tShell = useTranslations("shell");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 hidden items-center gap-6 border-b border-white/10 bg-slate-950/60 px-6 py-2.5 backdrop-blur md:flex">
      <Link href="/child" className="flex items-center gap-2 font-semibold">
        <span>✨</span> {tShell("childHome")}
      </Link>
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              isActive(pathname, tab.href)
                ? "bg-white/15 font-medium text-white"
                : "text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.emoji} {t(tab.key)}
          </Link>
        ))}
      </nav>
      <form action={logout} className="ml-auto">
        <button type="submit" className="text-xs text-slate-400 underline">
          {tShell("logout")}
        </button>
      </form>
    </header>
  );
}
