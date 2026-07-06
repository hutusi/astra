import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="text-6xl">✨</div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("common.appName")}
      </h1>
      <p className="text-muted-foreground">{t("home.tagline")}</p>
    </main>
  );
}
