// Goal (one-time milestone) management. Completion + bonus stars land with
// the ledger tools slice.
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { goals, plans, type Goal } from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";

export class GoalError extends Error {
  constructor(public code: "notFound") {
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
