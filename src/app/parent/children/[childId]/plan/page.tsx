import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { families } from "@/db/schema";
import { currentYearRange } from "@/lib/dates";
import { requireGuardian } from "@/lib/session";
import { getActivePlan } from "@/server/services/plans";
import { getChild } from "../get-child";
import {
  AddGoalDialog,
  AddHabitDialog,
  CompleteGoalButton,
  CreatePlanDialog,
  EditGoalDialog,
  EditHabitDialog,
  EditPlanDialog,
} from "./plan-dialogs";

export default async function ChildPlanPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const session = await requireGuardian();
  const { childId } = await params;
  const child = await getChild(session.familyId, childId);
  if (!child) notFound();
  const t = await getTranslations("plan");

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
  });
  const plan = await getActivePlan(db, childId);

  if (!plan) {
    const { start, end, year } = currentYearRange(
      family?.timezone ?? "Asia/Shanghai",
    );
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="text-5xl">🌌</div>
        <h2 className="text-xl font-semibold">
          {t("noPlanTitle", { name: child.name })}
        </h2>
        <p className="text-sm text-muted-foreground">{t("noPlanHint")}</p>
        <CreatePlanDialog
          childId={childId}
          defaults={{
            name: t("defaultPlanName", { year }),
            periodStart: start,
            periodEnd: end,
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <p className="text-xs text-muted-foreground">
            {plan.periodStart} → {plan.periodEnd}
          </p>
        </div>
        <EditPlanDialog plan={plan} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("habitsSection")}</CardTitle>
            <AddHabitDialog planId={plan.id} />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {plan.habits.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                {t("noHabits")}
              </p>
            )}
            {plan.habits.map((habit) => (
              <div key={habit.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl">{habit.emoji}</span>
                <div className="flex flex-1 flex-col">
                  <span
                    className={
                      habit.status !== "active"
                        ? "text-muted-foreground line-through"
                        : "font-medium"
                    }
                  >
                    {habit.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`scheduleTypes.${habit.scheduleType}`)}
                    {habit.scheduleType === "x_per_week" &&
                      ` · ${habit.timesPerWeek}/${t("perWeek")}`}
                  </span>
                </div>
                {habit.rewardMode === "stars" ? (
                  <Badge variant="secondary">
                    ⭐ {habit.starsPerCompletion}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    {t(`rewardModes.${habit.rewardMode}`)}
                  </Badge>
                )}
                {habit.status !== "active" && (
                  <Badge variant="outline">
                    {t(`habitStatuses.${habit.status}`)}
                  </Badge>
                )}
                <EditHabitDialog habit={habit} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("goalsSection")}</CardTitle>
            <AddGoalDialog planId={plan.id} />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {plan.goals.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                {t("noGoals")}
              </p>
            )}
            {plan.goals.map((goal) => (
              <div key={goal.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl">🎯</span>
                <div className="flex flex-1 flex-col">
                  <span
                    className={
                      goal.status === "abandoned"
                        ? "text-muted-foreground line-through"
                        : "font-medium"
                    }
                  >
                    {goal.name}
                  </span>
                  {goal.targetDate && (
                    <span className="text-xs text-muted-foreground">
                      {goal.targetDate}
                    </span>
                  )}
                </div>
                {goal.bonusStars > 0 && (
                  <Badge variant="secondary">⭐ {goal.bonusStars}</Badge>
                )}
                <Badge
                  variant={goal.status === "completed" ? "default" : "outline"}
                >
                  {t(`goalStatuses.${goal.status}`)}
                </Badge>
                {goal.status === "active" && (
                  <CompleteGoalButton goalId={goal.id} />
                )}
                {goal.status !== "completed" && <EditGoalDialog goal={goal} />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
