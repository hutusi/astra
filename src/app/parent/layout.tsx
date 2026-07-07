import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { requireGuardian } from "@/lib/session";
import { logout } from "@/app/login/actions";
import { ParentNav } from "./nav";

export default async function ParentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireGuardian();
  const t = await getTranslations("shell");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span>✨</span>
          <span className="font-semibold">{t("parentHome")}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.name}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              {t("logout")}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col p-4">{children}</main>
      <ParentNav />
    </div>
  );
}
