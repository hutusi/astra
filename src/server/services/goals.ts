// Goal (one-time milestone) management.
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { families, goals, plans, type Goal } from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";
import { todayIn } from "@/lib/dates";
import { insertBonus } from "./ledger";

export class GoalError extends Error {
  constructor(public code: "notFound" | "notActive") {
    super(code);
    this.name = "GoalError";
  }
}

export type GoalInput = {
  name: string;
  description?: string;
  bonusStars: number;
  targetDate?: string;
};

export async function createGoal(
  db: Db,
  session: Session,
  planId: string,
  input: GoalInput,
): Promise<Goal> {
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
    columns: { childId: true },
  });
  if (!plan) throw new GoalError("notFound");
  await assertCan(db, session, "goal.create", plan.childId);

  const [goal] = await db
    .insert(goals)
    .values({
      planId,
      name: input.name,
      description: input.description || null,
      bonusStars: Math.max(0, input.bonusStars),
      targetDate: input.targetDate || null,
    })
    .returning();
  return goal;
}

export async function updateGoal(
  db: Db,
  session: Session,
  goalId: string,
  input: GoalInput & { status?: "active" | "abandoned" },
): Promise<void> {
  const goal = await db.query.goals.findFirst({
    where: eq(goals.id, goalId),
    columns: { planId: true },
  });
  if (!goal) throw new GoalError("notFound");
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, goal.planId),
    columns: { childId: true },
  });
  if (!plan) throw new GoalError("notFound");
  await assertCan(db, session, "goal.create", plan.childId);

  await db
    .update(goals)
    .set({
      name: input.name,
      description: input.description || null,
      bonusStars: Math.max(0, input.bonusStars),
      targetDate: input.targetDate || null,
      ...(input.status && { status: input.status }),
    })
    .where(eq(goals.id, goalId));
}

/** Milestone reached: mark completed and pay the bonus atomically. */
export async function completeGoal(
  db: Db,
  session: Session,
  goalId: string,
): Promise<void> {
  const goal = await db.query.goals.findFirst({ where: eq(goals.id, goalId) });
  if (!goal) throw new GoalError("notFound");
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, goal.planId),
    columns: { id: true, childId: true },
  });
  if (!plan) throw new GoalError("notFound");
  await assertCan(db, session, "goal.complete", plan.childId);
  if (goal.status !== "active") throw new GoalError("notActive");

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
    columns: { timezone: true },
  });
  const occurredOn = todayIn(family?.timezone ?? "Asia/Shanghai");

  await db.transaction(async (tx) => {
    // Status guard: completes (and pays) exactly once under concurrency.
    const updated = await tx
      .update(goals)
      .set({
        status: "completed",
        completedAt: new Date(),
        completedById: session.userId,
      })
      .where(and(eq(goals.id, goalId), eq(goals.status, "active")))
      .returning({ id: goals.id });
    if (updated.length === 0) throw new GoalError("notActive");

    if (goal.bonusStars > 0) {
      await insertBonus(tx, {
        childId: plan.childId,
        amount: goal.bonusStars,
        note: `🎯 ${goal.name}`,
        goalId: goal.id,
        planId: plan.id,
        occurredOn,
        createdById: session.userId,
      });
    }
  });
}
