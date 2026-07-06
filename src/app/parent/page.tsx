import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireGuardian } from "@/lib/session";

export default async function ParentDashboard() {
  const session = await requireGuardian();
  const t = await getTranslations("parentDashboard");

  const children = await db.query.users.findMany({
    where: and(eq(users.familyId, session.familyId), eq(users.role, "child")),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{child.avatar}</span>
                {child.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("comingSoon")}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
