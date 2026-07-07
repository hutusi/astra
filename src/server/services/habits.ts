// Habit definition management. Check-ins live in checkins.ts.
import { and, eq, max } from "drizzle-orm";
import type { Db } from "@/db";
import {
  habits,
  plans,
  type Habit,
  type RewardMode,
  type ScheduleType,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan, type Action } from "@/lib/authz";
import { isoWeekday } from "@/lib/dates";

export class HabitError extends Error {
  constructor(public code: "notFound") {
    super(code);
    this.name = "HabitError";
  }
}

export type HabitInput = {
  name: string;
  emoji: string;
  description?: string;
  scheduleType: ScheduleType;
  scheduleDays?: number[]; // Mon=1..Sun=7
  timesPerWeek?: number;
  rewardMode: RewardMode;
  starsPerCompletion: number;
};

function scheduleColumns(input: HabitInput) {
  return {
    scheduleType: input.scheduleType,
    scheduleDays:
      input.scheduleType === "weekly_days" && input.scheduleDays?.length
        ? JSON.stringify([...input.scheduleDays].sort())
        : null,
    timesPerWeek:
      input.scheduleType === "x_per_week" ? (input.timesPerWeek ?? 1) : null,
    starsPerCompletion:
      input.rewardMode === "stars" ? Math.max(1, input.starsPerCompletion) : 0,
  };
}

async function assertOnPlanChild(
  db: Db,
  session: Session,
  planId: string,
  action: Action,
): Promise<string> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
    columns: { childId: true },
  });
  if (!plan) throw new HabitError("notFound");
  await assertCan(db, session, action, plan.childId);
  return plan.childId;
}

export async function createHabit(
  db: Db,
  session: Session,
  planId: string,
  input: HabitInput,
): Promise<Habit> {
  await assertOnPlanChild(db, session, planId, "habit.create");

  const [{ maxOrder }] = await db
    .select({ maxOrder: max(habits.sortOrder) })
    .from(habits)
    .where(eq(habits.planId, planId));

  const [habit] = await db
    .insert(habits)
    .values({
      planId,
      name: input.name,
      emoji: input.emoji,
      description: input.description || null,
      rewardMode: input.rewardMode,
      sortOrder: (maxOrder ?? 0) + 1,
      ...scheduleColumns(input),
    })
    .returning();
  return habit;
}

export async function updateHabit(
  db: Db,
  session: Session,
  habitId: string,
  input: HabitInput & { status?: "active" | "paused" | "archived" },
): Promise<void> {
  const habit = await db.query.habits.findFirst({
    where: eq(habits.id, habitId),
    columns: { planId: true },
  });
  if (!habit) throw new HabitError("notFound");
  await assertOnPlanChild(db, session, habit.planId, "habit.edit");

  await db
    .update(habits)
    .set({
      name: input.name,
      emoji: input.emoji,
      description: input.description || null,
      rewardMode: input.rewardMode,
      ...scheduleColumns(input),
      ...(input.status && {
        status: input.status,
        archivedAt: input.status === "archived" ? new Date() : null,
      }),
    })
    .where(eq(habits.id, habitId));
}

/** Active habits scheduled for `date`, for the child's active plan. */
export async function habitsForDate(
  db: Db,
  childId: string,
  date: string,
): Promise<Habit[]> {
  const plan = await db.query.plans.findFirst({
    where: and(eq(plans.childId, childId), eq(plans.status, "active")),
    columns: { id: true },
  });
  if (!plan) return [];

  const all = await db.query.habits.findMany({
    where: and(eq(habits.planId, plan.id), eq(habits.status, "active")),
    orderBy: (h, { asc }) => [asc(h.sortOrder), asc(h.createdAt)],
  });

  const weekday = isoWeekday(date);
  return all.filter((habit) => {
    if (habit.scheduleType === "daily") return true;
    if (habit.scheduleType === "weekly_days") {
      const days: number[] = habit.scheduleDays
        ? JSON.parse(habit.scheduleDays)
        : [];
      return days.includes(weekday);
    }
    return true; // x_per_week: always offered; weekly quota shown in UI
  });
}
