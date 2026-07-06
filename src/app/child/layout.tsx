import { getTranslations } from "next-intl/server";
import { requireChild } from "@/lib/session";
import { logout } from "@/app/login/actions";

export default async function ChildLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireChild();
  const t = await getTranslations("shell");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span>✨</span>
          <span className="font-semibold">{t("childHome")}</span>
        </div>
        <form action={logout}>
          <button type="submit" className="text-xs text-slate-400 underline">
            {t("logout")}
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col p-4">{children}</main>
    </div>
  );
}
