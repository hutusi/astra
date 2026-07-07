import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { requireGuardian } from "@/lib/session";
import { getBalance } from "@/server/services/ledger";
import { getActivePlan } from "@/server/services/plans";
import { getChild } from "./get-child";

export default async function ChildOverviewPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const session = await requireGuardian();
  const { childId } = await params;
  const child = await getChild(session.familyId, childId);
  if (!child) notFound();

  const t = await getTranslations("childOverview");
  const tLedger = await getTranslations("ledger");

  const [plan, balance] = await Promise.all([
    getActivePlan(db, childId),
    getBalance(db, childId),
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle>{t("balanceSection")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-baseline gap-4">
          <span className="text-3xl font-semibold text-amber-600">
            ⭐ {balance.confirmed}
          </span>
          {balance.pending > 0 && (
            <span className="text-sm text-muted-foreground">
              +{balance.pending} {tLedger("pendingLabel")}
            </span>
          )}
          {balance.reserved > 0 && (
            <span className="text-sm text-muted-foreground">
              {balance.reserved} {tLedger("reservedLabel")}
            </span>
          )}
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
