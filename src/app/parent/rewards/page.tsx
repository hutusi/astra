import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { requireGuardian } from "@/lib/session";
import {
  listRewards,
  pendingRedemptionsForFamily,
} from "@/server/services/redemptions";
import {
  AddRewardDialog,
  EditRewardDialog,
  RedemptionQueueList,
} from "./reward-dialogs";

export default async function ParentRewardsPage() {
  const session = await requireGuardian();
  const t = await getTranslations("parentRewards");

  const [catalog, pending] = await Promise.all([
    listRewards(db, session.familyId),
    pendingRedemptionsForFamily(db, session.familyId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("pendingSection")} ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            <RedemptionQueueList items={pending} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("catalogSection")}</CardTitle>
          <AddRewardDialog />
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {catalog.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">
              {t("noRewards")}
            </p>
          )}
          {catalog.map((reward) => (
            <div key={reward.id} className="flex items-center gap-3 py-3">
              <span className="text-2xl">{reward.emoji}</span>
              <div className="flex flex-1 flex-col">
                <span
                  className={
                    reward.active
                      ? "font-medium"
                      : "text-muted-foreground line-through"
                  }
                >
                  {reward.name}
                </span>
                {reward.description && (
                  <span className="text-xs text-muted-foreground">
                    {reward.description}
                  </span>
                )}
              </div>
              <Badge variant="secondary">⭐ {reward.costStars}</Badge>
              {!reward.active && (
                <Badge variant="outline">{t("inactive")}</Badge>
              )}
              <EditRewardDialog reward={reward} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
