import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { families, users } from "@/db/schema";
import { addDays, mondayOf, todayIn } from "@/lib/dates";
import { requireChild } from "@/lib/session";
import {
  checkInsBetween,
  checkInsForDate,
} from "@/server/services/checkins";
import { habitsForDate } from "@/server/services/habits";
import { CheckInButton, type CheckInDisplayState } from "./check-in-button";

export default async function ChildToday() {
  const session = await requireChild();
  const t = await getTranslations("childHome");

  const [me, family] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db.query.families.findFirst({ where: eq(families.id, session.familyId) }),
  ]);
  const today = todayIn(family?.timezone ?? "Asia/Shanghai");
  const weekStart = mondayOf(today);

  const [habits, todays, weeks] = await Promise.all([
    habitsForDate(db, session.userId, today),
    checkInsForDate(db, session.userId, today),
    checkInsBetween(db, session.userId, weekStart, addDays(weekStart, 6)),
  ]);

  const todayByHabit = new Map(todays.map((c) => [c.habitId, c]));
  const weekCounts = new Map<string, number>();
  for (const c of weeks) {
    weekCounts.set(c.habitId, (weekCounts.get(c.habitId) ?? 0) + 1);
  }

  const done = habits.filter((h) => todayByHabit.has(h.id)).length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 lg:max-w-3xl">
      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <span className="text-4xl">{me?.avatar}</span>
        <h1 className="text-xl font-semibold">
          {t("greeting", { name: session.name })}
        </h1>
        <p className="text-xs text-slate-400">
          {today} · {t("progress", { done, total: habits.length })}
        </p>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-5xl">🌌</div>
          <p className="text-slate-300">{t("noHabitsToday")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {habits.map((habit) => {
            const checkInRecord = todayByHabit.get(habit.id);
            const state: CheckInDisplayState = !checkInRecord
              ? "unchecked"
              : checkInRecord.status === "pending"
                ? "pending"
                : "confirmed";
            return (
              <li
                key={habit.id}
                className="flex items-center gap-3 rounded-2xl bg-white/10 p-4"
              >
                <span className="text-3xl">{habit.emoji}</span>
                <div className="flex flex-1 flex-col">
                  <span className="font-medium">{habit.name}</span>
                  <span className="text-xs text-slate-400">
                    {habit.rewardMode === "stars" && (
                      <span className="text-amber-300">
                        ⭐ ×{habit.starsPerCompletion}{" "}
                      </span>
                    )}
                    {habit.scheduleType === "x_per_week" &&
                      t("weeklyProgress", {
                        done: weekCounts.get(habit.id) ?? 0,
                        target: habit.timesPerWeek ?? 0,
                      })}
                    {state === "pending" && (
                      <span className="text-amber-300">
                        {t("waitingConfirm")}
                      </span>
                    )}
                  </span>
                </div>
                <CheckInButton habitId={habit.id} state={state} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
