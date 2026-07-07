"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SUB_TABS = [
  { segment: "", key: "overview" },
  { segment: "/plan", key: "plan" },
  { segment: "/ledger", key: "ledger" },
  { segment: "/review", key: "review" },
] as const;

/** Sub-navigation between one child's pages, shown on all breakpoints. */
export function ChildTabs({ childId }: { childId: string }) {
  const t = useTranslations("childTabs");
  const pathname = usePathname();
  const base = `/parent/children/${childId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {SUB_TABS.map((tab) => {
        const href = `${base}${tab.segment}`;
        const active =
          tab.segment === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.key}
            href={href}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-center text-sm transition ${
              active
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
