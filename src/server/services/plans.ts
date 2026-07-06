// Plan (Constellation) lifecycle. Pure TS, no Next imports.
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  goals,
  habits,
  plans,
  users,
  type Goal,
  type Habit,
  type Plan,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";

export class PlanError extends Error {
  constructor(public code: "activePlanExists" | "childNotFound" | "notFound") {
    super(code);
    this.name = "PlanError";
  }
}

export type PlanWithContents = Plan & { habits: Habit[]; goals: Goal[] };

export async function getActivePlan(
  db: Db,
  childId: string,
): Promise<PlanWithContents | null> {
  const plan = await db.query.plans.findFirst({
    where: and(eq(plans.childId, childId), eq(plans.status, "active")),
  });
  if (!plan) return null;
  return withContents(db, plan);
}

export async function getPlan(
  db: Db,
  planId: string,
): Promise<PlanWithContents | null> {
  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
  if (!plan) return null;
  return withContents(db, plan);
}

async function withContents(db: Db, plan: Plan): Promise<PlanWithContents> {
  const [planHabits, planGoals] = await Promise.all([
    db.query.habits.findMany({
      where: eq(habits.planId, plan.id),
      orderBy: [asc(habits.sortOrder), asc(habits.createdAt)],
    }),
    db.query.goals.findMany({
      where: eq(goals.planId, plan.id),
      orderBy: [asc(goals.createdAt)],
    }),
  ]);
  return { ...plan, habits: planHabits, goals: planGoals };
}

export async function createPlan(
  db: Db,
  session: Session,
  input: {
    childId: string;
    name: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  },
): Promise<Plan> {
  await assertCan(db, session, "plan.edit", input.childId);

  const child = await db.query.users.findFirst({
    where: eq(users.id, input.childId),
    columns: { stage: true },
  });
  if (!child?.stage) throw new PlanError("childNotFound");

  const existing = await db.query.plans.findFirst({
    where: and(eq(plans.childId, input.childId), eq(plans.status, "active")),
    columns: { id: true },
  });
  if (existing) throw new PlanError("activePlanExists");

  const [plan] = await db
    .insert(plans)
    .values({
      childId: input.childId,
      name: input.name,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      stageAtCreation: child.stage,
      status: "active",
      notes: input.notes || null,
    })
    .returning();
  return plan;
}

export async function updatePlan(
  db: Db,
  session: Session,
  planId: string,
  input: {
    name?: string;
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
    status?: "draft" | "active" | "archived";
  },
): Promise<void> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
    columns: { childId: true },
  });
  if (!plan) throw new PlanError("notFound");
  await assertCan(db, session, "plan.edit", plan.childId);

  await db
    .update(plans)
    .set({
      ...(input.name && { name: input.name }),
      ...(input.periodStart && { periodStart: input.periodStart }),
      ...(input.periodEnd && { periodEnd: input.periodEnd }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
      ...(input.status && { status: input.status }),
    })
    .where(eq(plans.id, planId));
}
