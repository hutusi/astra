// The weekly review ritual — where "co-authored" actually happens. Stats
// are computed live from check_ins/star_transactions (nothing stored to
// corrupt); only the two notes persist.
import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@/db";
import {
  starTransactions,
  weeklyReviews,
  type Habit,
  type WeeklyReview,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";
import { addDays, isoWeekday, mondayOf } from "@/lib/dates";
import { checkInsBetween } from "./checkins";
import { getActivePlan } from "./plans";

const STREAK_LOOKBACK_DAYS = 90;

export function scheduledCountForWeek(habit: Habit): number {
  if (habit.scheduleType === "x_per_week") return habit.timesPerWeek ?? 1;
  if (habit.scheduleType === "weekly_days" && habit.scheduleDays) {
    return (JSON.parse(habit.scheduleDays) as number[]).length;
  }
  return 7;
}

/**
 * Current streak for a habit given the set of checked-in dates.
 * daily / weekly_days: consecutive scheduled days, ending at the most
 * recent scheduled day (today is forgiven if not yet checked).
 * x_per_week: consecutive weeks meeting the quota (current week counts
 * once met, otherwise starts from last week).
 */
export function currentStreak(
  habit: Habit,
  checkedDates: Set<string>,
  today: string,
): number {
  if (habit.scheduleType === "x_per_week") {
    const target = habit.timesPerWeek ?? 1;
    let weekStart = mondayOf(today);
    const countWeek = (start: string) => {
      let count = 0;
      for (let i = 0; i < 7; i++) {
        if (checkedDates.has(addDays(start, i))) count++;
      }
      return count;
    };
    let streak = 0;
    if (countWeek(weekStart) >= target) streak++;
    weekStart = addDays(weekStart, -7);
    while (streak < 52 && countWeek(weekStart) >= target) {
      streak++;
      weekStart = addDays(weekStart, -7);
    }
    return streak;
  }

  const scheduledDays =
    habit.scheduleType === "weekly_days" && habit.scheduleDays
      ? (JSON.parse(habit.scheduleDays) as number[])
      : [1, 2, 3, 4, 5, 6, 7];
  const isScheduled = (date: string) =>
    scheduledDays.includes(isoWeekday(date));

  let date = today;
  // Walk back to the most recent scheduled day; forgive an unchecked today.
  while (!isScheduled(date)) date = addDays(date, -1);
  if (!checkedDates.has(date)) {
    if (date === today) {
      date = addDays(date, -1);
      while (!isScheduled(date)) date = addDays(date, -1);
    }
    if (!checkedDates.has(date)) return 0;
  }

  let streak = 0;
  for (let i = 0; i < STREAK_LOOKBACK_DAYS && checkedDates.has(date); i++) {
    streak++;
    date = addDays(date, -1);
    while (!isScheduled(date)) date = addDays(date, -1);
  }
  return streak;
}

export type HabitWeekStat = {
  habit: Habit;
  done: number;
  scheduled: number;
  streak: number;
};

export type WeekStats = {
  weekStart: string;
  weekEnd: string;
  habits: HabitWeekStat[];
  starsIn: number;
  starsOut: number;
};

export async function getWeekStats(
  db: Db,
  childId: string,
  weekStart: string,
  today: string,
): Promise<WeekStats | null> {
  const plan = await getActivePlan(db, childId);
  if (!plan) return null;
  const weekEnd = addDays(weekStart, 6);

  const [weekCheckIns, streakCheckIns, weekTxs] = await Promise.all([
    checkInsBetween(db, childId, weekStart, weekEnd),
    checkInsBetween(
      db,
      childId,
      addDays(today, -STREAK_LOOKBACK_DAYS),
      today,
    ),
    db
      .select()
      .from(starTransactions)
      .where(
        and(
          eq(starTransactions.childId, childId),
          gte(starTransactions.occurredOn, weekStart),
          lte(starTransactions.occurredOn, weekEnd),
        ),
      ),
  ]);

  const weekByHabit = new Map<string, number>();
  for (const checkInRow of weekCheckIns) {
    weekByHabit.set(
      checkInRow.habitId,
      (weekByHabit.get(checkInRow.habitId) ?? 0) + 1,
    );
  }
  const datesByHabit = new Map<string, Set<string>>();
  for (const checkInRow of streakCheckIns) {
    let set = datesByHabit.get(checkInRow.habitId);
    if (!set) datesByHabit.set(checkInRow.habitId, (set = new Set()));
    set.add(checkInRow.date);
  }

  const habitStats = plan.habits
    .filter((habit) => habit.status === "active")
    .map((habit) => ({
      habit,
      done: weekByHabit.get(habit.id) ?? 0,
      scheduled: scheduledCountForWeek(habit),
      streak: currentStreak(
        habit,
        datesByHabit.get(habit.id) ?? new Set(),
        today,
      ),
    }));

  let starsIn = 0;
  let starsOut = 0;
  for (const tx of weekTxs) {
    if (tx.status === "rejected") continue;
    if (tx.amount > 0) starsIn += tx.amount;
    else starsOut += -tx.amount;
  }

  return { weekStart, weekEnd, habits: habitStats, starsIn, starsOut };
}

export async function getReview(
  db: Db,
  childId: string,
  weekStart: string,
): Promise<WeeklyReview | null> {
  return (
    (await db.query.weeklyReviews.findFirst({
      where: and(
        eq(weeklyReviews.childId, childId),
        eq(weeklyReviews.weekStart, weekStart),
      ),
    })) ?? null
  );
}

export async function saveReviewNote(
  db: Db,
  session: Session,
  input: { childId: string; weekStart: string; note: string },
): Promise<void> {
  await assertCan(db, session, "review.write", input.childId);
  const isGuardian = session.role === "guardian";
  const plan = await getActivePlan(db, input.childId);

  await db
    .insert(weeklyReviews)
    .values({
      childId: input.childId,
      weekStart: input.weekStart,
      planId: plan?.id ?? null,
      parentNote: isGuardian ? input.note : null,
      childNote: isGuardian ? null : input.note,
      completedAt: isGuardian ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [weeklyReviews.childId, weeklyReviews.weekStart],
      set: isGuardian
        ? { parentNote: input.note, completedAt: new Date() }
        : { childNote: input.note },
    });
}
