import { getTranslations } from "next-intl/server";
import { requireChild } from "@/lib/session";
import { db } from "@/db";
import { getActivePlan } from "@/server/services/plans";

export default async function ChildPlanView() {
  const session = await requireChild();
  const t = await getTranslations("childPlan");
  const plan = await getActivePlan(db, session.userId);

  if (!plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="text-5xl">🌌</div>
        <p className="text-slate-300">{t("noPlan")}</p>
      </div>
    );
  }

  const activeHabits = plan.habits.filter((h) => h.status === "active");
  const goals = plan.goals.filter((g) => g.status !== "abandoned");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-xl font-semibold">🌌 {plan.name}</h1>
        <p className="text-xs text-slate-400">
          {plan.periodStart} → {plan.periodEnd}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-300">{t("myHabits")}</h2>
        <ul className="flex flex-col gap-2">
          {activeHabits.map((habit) => (
            <li
              key={habit.id}
              className="flex items-center gap-3 rounded-xl bg-white/10 p-3"
            >
              <span className="text-2xl">{habit.emoji}</span>
              <span className="flex-1">{habit.name}</span>
              {habit.rewardMode === "stars" && (
                <span className="text-xs text-amber-300">
                  ⭐ ×{habit.starsPerCompletion}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-300">{t("myGoals")}</h2>
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-center gap-3 rounded-xl bg-white/10 p-3"
            >
              <span className="text-2xl">
                {goal.status === "completed" ? "🏆" : "🎯"}
              </span>
              <span
                className={
                  goal.status === "completed" ? "flex-1 line-through" : "flex-1"
                }
              >
                {goal.name}
              </span>
              {goal.bonusStars > 0 && (
                <span className="text-xs text-amber-300">
                  ⭐ +{goal.bonusStars}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
