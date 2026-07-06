import { getTranslations } from "next-intl/server";
import { requireChild } from "@/lib/session";

export default async function ChildStarsPage() {
  await requireChild();
  const t = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="text-5xl">⭐</div>
      <p className="text-slate-300">{t("loading")}</p>
    </div>
  );
}
