import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { families } from "@/db/schema";
import { requireGuardian } from "@/lib/session";
import { listFamilyMembers } from "@/server/services/families";
import {
  AddChildDialog,
  AddGuardianDialog,
  EditChildDialog,
} from "./member-dialogs";

export default async function SettingsPage() {
  const session = await requireGuardian();
  const t = await getTranslations("settings");
  const tStages = await getTranslations("stages");

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
  });
  const { children, guardians } = await listFamilyMembers(
    db,
    session.familyId,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("familySection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="font-medium">{family?.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t("familyCode")}
            </span>
            <span className="rounded bg-muted px-3 py-1 font-mono text-lg tracking-[0.2em]">
              {family?.code}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t("familyCodeHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("childrenSection")}</CardTitle>
          <AddChildDialog />
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {children.map((child) => (
            <div key={child.id} className="flex items-center gap-3 py-3">
              <span className="text-3xl">{child.avatar}</span>
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{child.name}</span>
                <span className="text-xs text-muted-foreground">
                  {child.birthdate ?? "—"}
                </span>
              </div>
              {child.stage && (
                <Badge variant="secondary">{tStages(child.stage)}</Badge>
              )}
              <EditChildDialog child={child} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("guardiansSection")}</CardTitle>
          <AddGuardianDialog />
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {guardians.map((guardian) => (
            <div key={guardian.id} className="flex items-center gap-3 py-3">
              <span className="text-3xl">{guardian.avatar}</span>
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{guardian.name}</span>
                <span className="text-xs text-muted-foreground">
                  {guardian.email}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
