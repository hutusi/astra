// Penalty guardrails, reversal semantics, adjust floor, goal bonus.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "../src/db/schema";
import type { Session } from "../src/lib/auth/token";
import { AuthzError } from "../src/lib/authz";
import { checkIn } from "../src/server/services/checkins";
import { completeGoal, GoalError } from "../src/server/services/goals";
import {
  createPenaltyRule,
  getBalance,
  LedgerError,
  recordAdjust,
  recordPenalty,
  reverseTransaction,
} from "../src/server/services/ledger";
import {
  createReward,
  decideRedemption,
  RedemptionError,
  requestRedemption,
} from "../src/server/services/redemptions";

const MIGRATIONS = path.join(import.meta.dir, "..", "drizzle");
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "astra-test-"));
let dbCount = 0;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function setup() {
  const client = createClient({
    url: `file:${path.join(TMP_DIR, `penalty-${++dbCount}.db`)}`,
  });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });

  const [family] = await db
    .insert(schema.families)
    .values({ name: "测试家", code: "TEST" })
    .returning();
  const [guardian] = await db
    .insert(schema.users)
    .values({
      familyId: family.id,
      role: "guardian",
      name: "家长",
      email: "p@test",
      passwordHash: "x",
    })
    .returning();
  const [child] = await db
    .insert(schema.users)
    .values({
      familyId: family.id,
      role: "child",
      name: "孩子",
      pinHash: "x",
      stage: "co_authored",
    })
    .returning();
  const [plan] = await db
    .insert(schema.plans)
    .values({
      childId: child.id,
      name: "星图",
      periodStart: "2020-01-01",
      periodEnd: "2099-12-31",
      stageAtCreation: "co_authored",
    })
    .returning();
  const [habit] = await db
    .insert(schema.habits)
    .values({
      planId: plan.id,
      name: "刷牙",
      scheduleType: "daily",
      rewardMode: "stars",
      starsPerCompletion: 10,
    })
    .returning();
  const [goal] = await db
    .insert(schema.goals)
    .values({ planId: plan.id, name: "学会自由泳", bonusStars: 5 })
    .returning();

  const guardianSession: Session = {
    userId: guardian.id,
    familyId: family.id,
    role: "guardian",
    name: guardian.name,
  };
  const childSession: Session = {
    userId: child.id,
    familyId: family.id,
    role: "child",
    name: child.name,
  };

  // 10 confirmed stars to start.
  await checkIn(db, guardianSession, { habitId: habit.id });

  const rule = await createPenaltyRule(db, guardianSession, {
    childId: child.id,
    title: "作业拖拉",
    maxStars: 3,
  });

  return { db, family, child, plan, goal, rule, guardianSession, childSession };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

describe("guarded penalties, reversals, adjustments, goal bonus", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  test("penalty is capped by the rule", async () => {
    const penalty = await recordPenalty(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      ruleId: ctx.rule.id,
      note: "今天作业拖到十点",
    });
    expect(penalty.amount).toBe(-3); // rule cap, not more
    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(7);
  });

  test("penalty cannot touch reserved stars", async () => {
    const reward = await createReward(ctx.db, ctx.guardianSession, {
      name: "冰淇淋",
      emoji: "🍦",
      costStars: 9,
    });
    await requestRedemption(ctx.db, ctx.childSession, reward.id);
    // available = 10 − 9 = 1 → penalty clamps to 1, not the rule's 3
    const penalty = await recordPenalty(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      ruleId: ctx.rule.id,
      note: "扣星",
    });
    expect(penalty.amount).toBe(-1);
  });

  test("penalty refused when nothing is deductible", async () => {
    const reward = await createReward(ctx.db, ctx.guardianSession, {
      name: "大奖",
      emoji: "🎁",
      costStars: 10,
    });
    await requestRedemption(ctx.db, ctx.childSession, reward.id);
    await expect(
      recordPenalty(ctx.db, ctx.guardianSession, {
        childId: ctx.child.id,
        ruleId: ctx.rule.id,
        note: "扣星",
      }),
    ).rejects.toThrow(LedgerError);
  });

  test("penalty requires an active rule and a reason", async () => {
    await ctx.db
      .update(schema.penaltyRules)
      .set({ active: false })
      .where(eq(schema.penaltyRules.id, ctx.rule.id));
    await expect(
      recordPenalty(ctx.db, ctx.guardianSession, {
        childId: ctx.child.id,
        ruleId: ctx.rule.id,
        note: "扣星",
      }),
    ).rejects.toThrow(LedgerError);

    await ctx.db
      .update(schema.penaltyRules)
      .set({ active: true })
      .where(eq(schema.penaltyRules.id, ctx.rule.id));
    await expect(
      recordPenalty(ctx.db, ctx.guardianSession, {
        childId: ctx.child.id,
        ruleId: ctx.rule.id,
        note: "   ",
      }),
    ).rejects.toThrow(LedgerError);
  });

  test("reversal negates exactly once", async () => {
    const penalty = await recordPenalty(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      ruleId: ctx.rule.id,
      note: "误扣",
    });
    const reversal = await reverseTransaction(
      ctx.db,
      ctx.guardianSession,
      penalty.id,
    );
    expect(reversal.amount).toBe(3);
    expect((await getBalance(ctx.db, ctx.child.id)).confirmed).toBe(10);

    await expect(
      reverseTransaction(ctx.db, ctx.guardianSession, penalty.id),
    ).rejects.toThrow(LedgerError);
  });

  test("reversing an earn is refused when stars are already spent", async () => {
    const [earn] = await ctx.db
      .select()
      .from(schema.starTransactions)
      .where(eq(schema.starTransactions.type, "earn"));
    // Spend 9 of the 10 stars.
    const reward = await createReward(ctx.db, ctx.guardianSession, {
      name: "冰淇淋",
      emoji: "🍦",
      costStars: 9,
    });
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      reward.id,
    );
    await decideRedemption(
      ctx.db,
      ctx.guardianSession,
      request.id,
      "approved",
    );
    // Reversing the 10-star earn would leave −9.
    await expect(
      reverseTransaction(ctx.db, ctx.guardianSession, earn.id),
    ).rejects.toThrow(LedgerError);
  });

  test("negative adjustments floor at zero", async () => {
    await expect(
      recordAdjust(ctx.db, ctx.guardianSession, {
        childId: ctx.child.id,
        amount: -11,
        note: "太多了",
      }),
    ).rejects.toThrow(LedgerError);

    await recordAdjust(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      amount: -10,
      note: "清零",
    });
    expect((await getBalance(ctx.db, ctx.child.id)).confirmed).toBe(0);
  });

  test("redemption approval re-checks the balance", async () => {
    const reward = await createReward(ctx.db, ctx.guardianSession, {
      name: "大奖",
      emoji: "🎁",
      costStars: 10,
    });
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      reward.id,
    );
    // Stars vanish between request and approval.
    await ctx.db
      .update(schema.redemptions)
      .set({ status: "canceled" })
      .where(eq(schema.redemptions.id, request.id));
    await recordAdjust(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      amount: -5,
      note: "调整",
    });
    await ctx.db
      .update(schema.redemptions)
      .set({ status: "requested" })
      .where(eq(schema.redemptions.id, request.id));

    await expect(
      decideRedemption(ctx.db, ctx.guardianSession, request.id, "approved"),
    ).rejects.toThrow(RedemptionError);
  });

  test("goal completion pays the bonus exactly once", async () => {
    await completeGoal(ctx.db, ctx.guardianSession, ctx.goal.id);
    expect((await getBalance(ctx.db, ctx.child.id)).confirmed).toBe(15);

    await expect(
      completeGoal(ctx.db, ctx.guardianSession, ctx.goal.id),
    ).rejects.toThrow(GoalError);
    expect((await getBalance(ctx.db, ctx.child.id)).confirmed).toBe(15);
  });

  test("co_authored children cannot use guardian ledger tools", async () => {
    await expect(
      recordPenalty(ctx.db, ctx.childSession, {
        childId: ctx.child.id,
        ruleId: ctx.rule.id,
        note: "自罚",
      }),
    ).rejects.toThrow(AuthzError);
    await expect(
      recordAdjust(ctx.db, ctx.childSession, {
        childId: ctx.child.id,
        amount: 100,
        note: "发财",
      }),
    ).rejects.toThrow(AuthzError);
    await expect(
      completeGoal(ctx.db, ctx.childSession, ctx.goal.id),
    ).rejects.toThrow(AuthzError);
  });
});
