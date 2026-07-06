import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireGuardian } from "@/lib/session";
import { getActivePlan } from "@/server/services/plans";

export default async function ChildOverviewPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const session = await requireGuardian();
  const { childId } = await params;
  const t = await getTranslations("childOverview");
  const tStages = await getTranslations("stages");

  const child = await db.query.users.findFirst({
    where: and(
      eq(users.id, childId),
      eq(users.familyId, session.familyId),
      eq(users.role, "child"),
    ),
  });
  if (!child) notFound();

  const plan = await getActivePlan(db, childId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{child.avatar}</span>
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{child.name}</h1>
          {child.stage && (
            <Badge variant="secondary" className="w-fit">
              {tStages(child.stage)}
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("ledgerSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href={`/parent/children/${childId}/ledger`}
            className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-muted"
          >
            <span className="font-medium">⭐ {t("ledgerLink")}</span>
            <span>→</span>
          </Link>
          <Link
            href={`/parent/children/${childId}/review`}
            className="mt-2 flex items-center justify-between rounded-lg border p-3 transition hover:bg-muted"
          >
            <span className="font-medium">📒 {t("reviewLink")}</span>
            <span>→</span>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("planSection")}</CardTitle>
        </CardHeader>
        <CardContent>
          {plan ? (
            <Link
              href={`/parent/children/${childId}/plan`}
              className="flex items-center justify-between rounded-lg border p-3 transition hover:bg-muted"
            >
              <div className="flex flex-col">
                <span className="font-medium">{plan.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t("planSummary", {
                    habits: plan.habits.filter((h) => h.status === "active")
                      .length,
                    goals: plan.goals.filter((g) => g.status === "active")
                      .length,
                  })}
                </span>
              </div>
              <span>→</span>
            </Link>
          ) : (
            <Link
              href={`/parent/children/${childId}/plan`}
              className="text-sm text-muted-foreground underline"
            >
              {t("noPlanYet")}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
