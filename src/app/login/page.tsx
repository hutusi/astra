import { getTranslations } from "next-intl/server";
import { StarField } from "@/components/star-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChildLoginForm } from "./child-login-form";
import { ParentLoginForm } from "./parent-login-form";

export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-white">
      <div className="fixed inset-0 -z-20 bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950" />
      <StarField />
      <div className="flex flex-col items-center gap-2">
        <div className="text-5xl">✨</div>
        <h1 className="text-2xl font-semibold tracking-tight">Astra</h1>
        <p className="text-sm text-slate-300">{t("title")}</p>
      </div>

      <Tabs defaultValue="child" className="w-full max-w-sm">
        <TabsList className="w-full bg-white/10">
          <TabsTrigger value="child" className="flex-1">
            {t("childTab")}
          </TabsTrigger>
          <TabsTrigger value="parent" className="flex-1">
            {t("parentTab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="child" className="mt-6">
          <ChildLoginForm />
        </TabsContent>
        <TabsContent value="parent" className="mt-6">
          <ParentLoginForm />
        </TabsContent>
      </Tabs>
    </main>
  );
}
