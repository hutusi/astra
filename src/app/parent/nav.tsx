"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const TABS = [
  { href: "/parent", key: "dashboard", emoji: "🏠" },
  { href: "/parent/rewards", key: "rewards", emoji: "🎁" },
  { href: "/parent/settings", key: "settings", emoji: "⚙️" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/parent"
    ? pathname === "/parent" || pathname.startsWith("/parent/children")
    : pathname.startsWith(href);
}

/** Phone shell: sticky bottom tab bar. Hidden on md+. */
export function ParentNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
            isActive(pathname, tab.href)
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          }`}
        >
          <span className="text-lg">{tab.emoji}</span>
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

/** Desktop shell: sticky top bar with brand, links, and account. md+ only. */
export function ParentTopNav({ userName }: { userName: string }) {
  const t = useTranslations("nav");
  const tShell = useTranslations("shell");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 hidden items-center gap-6 border-b bg-background/95 px-6 py-2.5 backdrop-blur md:flex">
      <Link href="/parent" className="flex items-center gap-2 font-semibold">
        <span>✨</span> Astra
      </Link>
      <nav className="flex items-center gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm transition ${
              isActive(pathname, tab.href)
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            {tab.emoji} {t(tab.key)}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{userName}</span>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit">
            {tShell("logout")}
          </Button>
        </form>
      </div>
    </header>
  );
}
