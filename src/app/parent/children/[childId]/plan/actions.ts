"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { REWARD_MODES, SCHEDULE_TYPES } from "@/db/schema";
import { AuthzError } from "@/lib/authz";
import { getSession } from "@/lib/session";
import {
  completeGoal,
  createGoal,
  GoalError,
  updateGoal,
} from "@/server/services/goals";
import {
  createHabit,
  HabitError,
  updateHabit,
  type HabitInput,
} from "@/server/services/habits";
import { createPlan, PlanError, updatePlan } from "@/server/services/plans";

export type PlanFormState = { ok: true } | { error: string } | null;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal("").transform(() => undefined))
  .optional();

const planSchema = z.object({
  childId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

const habitSchema = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(8),
  description: z.string().max(200).optional(),
  scheduleType: z.enum(SCHEDULE_TYPES),
  timesPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  rewardMode: z.enum(REWARD_MODES),
  starsPerCompletion: z.coerce.number().int().min(1).max(20).default(1),
});

const goalSchema = z.object({
  name: z.string().trim().min(1).max(40),
  description: z.string().max(200).optional(),
  bonusStars: z.coerce.number().int().min(0).max(500).default(0),
  targetDate: dateString,
});

function errorState(error: unknown): PlanFormState {
  if (error instanceof PlanError) return { error: error.code };
  if (
    error instanceof HabitError ||
    error instanceof GoalError ||
    error instanceof AuthzError ||
    error instanceof z.ZodError
  ) {
    return { error: "invalid" };
  }
  throw error;
}

function scheduleDaysFrom(formData: FormData): number[] {
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => formData.get(`day-${d}`) === "on");
}

function habitInputFrom(formData: FormData): HabitInput {
  const parsed = habitSchema.parse(Object.fromEntries(formData));
  return { ...parsed, scheduleDays: scheduleDaysFrom(formData) };
}

async function requireSession() {
  const session = await getSession();
  if (!session) throw new AuthzError("plan.edit");
  return session;
}

export async function createPlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const input = planSchema.parse(Object.fromEntries(formData));
    await createPlan(db, session, input);
    revalidatePath(`/parent/children/${input.childId}/plan`);
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function updatePlanAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const planId = z.string().min(1).parse(formData.get("planId"));
    const input = planSchema
      .omit({ childId: true })
      .parse(Object.fromEntries(formData));
    await updatePlan(db, session, planId, input);
    revalidatePath("/parent/children", "layout");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function createHabitAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const planId = z.string().min(1).parse(formData.get("planId"));
    await createHabit(db, session, planId, habitInputFrom(formData));
    revalidatePath("/parent/children", "layout");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function updateHabitAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const habitId = z.string().min(1).parse(formData.get("habitId"));
    const status = z
      .enum(["active", "paused", "archived"])
      .parse(formData.get("status") ?? "active");
    await updateHabit(db, session, habitId, {
      ...habitInputFrom(formData),
      status,
    });
    revalidatePath("/parent/children", "layout");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function createGoalAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const planId = z.string().min(1).parse(formData.get("planId"));
    const input = goalSchema.parse(Object.fromEntries(formData));
    await createGoal(db, session, planId, input);
    revalidatePath("/parent/children", "layout");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function completeGoalAction(
  goalId: string,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    await completeGoal(db, session, goalId);
    revalidatePath("/parent/children", "layout");
    revalidatePath("/child/stars");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}

export async function updateGoalAction(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  try {
    const session = await requireSession();
    const goalId = z.string().min(1).parse(formData.get("goalId"));
    const status = z
      .enum(["active", "abandoned"])
      .parse(formData.get("status") ?? "active");
    const input = goalSchema.parse(Object.fromEntries(formData));
    await updateGoal(db, session, goalId, { ...input, status });
    revalidatePath("/parent/children", "layout");
  } catch (error) {
    return errorState(error);
  }
  return { ok: true };
}
