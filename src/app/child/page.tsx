import { getTranslations } from "next-intl/server";
import { requireChild } from "@/lib/session";

export default async function ChildHome() {
  const session = await requireChild();
  const t = await getTranslations("childHome");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl">🌟</div>
      <h1 className="text-2xl font-semibold">
        {t("greeting", { name: session.name })}
      </h1>
      <p className="text-slate-300">{t("comingSoon")}</p>
    </div>
  );
}
