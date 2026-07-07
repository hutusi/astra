// Ledger + check-in invariants, exercised against a throwaway libSQL file
// with the real migrations applied. Services are pure TS, so no Next server
// is needed. NOTE: not `:memory:` — @libsql/client hands the connection to
// each transaction() and lazily opens a NEW connection afterwards, which
// for :memory: means a fresh empty database.
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
import {
  checkIn,
  CheckInError,
  decideCheckIn,
  pendingForFamily,
  sweepAutoConfirm,
} from "../src/server/services/checkins";
import { getBalance } from "../src/server/services/ledger";

const MIGRATIONS = path.join(import.meta.dir, "..", "drizzle");
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "astra-test-"));
let dbCount = 0;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

async function setup() {
  const client = createClient({
    url: `file:${path.join(TMP_DIR, `ledger-${++dbCount}.db`)}`,
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
  const [starHabit] = await db
    .insert(schema.habits)
    .values({
      planId: plan.id,
      name: "刷牙",
      scheduleType: "daily",
      rewardMode: "stars",
      starsPerCompletion: 2,
    })
    .returning();
  const [streakHabit] = await db
    .insert(schema.habits)
    .values({
      planId: plan.id,
      name: "阅读",
      scheduleType: "daily",
      rewardMode: "streak",
      starsPerCompletion: 0,
    })
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

  return {
    db,
    family,
    guardian,
    child,
    plan,
    starHabit,
    streakHabit,
    guardianSession,
    childSession,
  };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

describe("check-in → ledger core loop", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  test("child self check-in creates a pending earn", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    expect(created.status).toBe("pending");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(0);
    expect(balance.pending).toBe(2);
  });

  test("same habit and day can only be logged once (child + guardian race)", async () => {
    await checkIn(ctx.db, ctx.childSession, { habitId: ctx.starHabit.id });
    await expect(
      checkIn(ctx.db, ctx.guardianSession, { habitId: ctx.starHabit.id }),
    ).rejects.toThrow(CheckInError);

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.pending + balance.confirmed).toBe(2);
  });

  test("guardian direct log settles immediately", async () => {
    const created = await checkIn(ctx.db, ctx.guardianSession, {
      habitId: ctx.starHabit.id,
    });
    expect(created.status).toBe("confirmed");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(2);
    expect(balance.pending).toBe(0);
  });

  test("guardian confirm moves pending stars to the balance", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    await decideCheckIn(ctx.db, ctx.guardianSession, created.id, "confirmed");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(2);
    expect(balance.pending).toBe(0);

    const [tx] = await ctx.db
      .select()
      .from(schema.starTransactions)
      .where(eq(schema.starTransactions.checkInId, created.id));
    expect(tx.status).toBe("confirmed");
    expect(tx.confirmedById).toBe(ctx.guardian.id);
  });

  test("rejection leaves no stars behind", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    await decideCheckIn(ctx.db, ctx.guardianSession, created.id, "rejected");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(0);
    expect(balance.pending).toBe(0);
  });

  test("a decision settles exactly once", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    await decideCheckIn(ctx.db, ctx.guardianSession, created.id, "confirmed");
    await expect(
      decideCheckIn(ctx.db, ctx.guardianSession, created.id, "confirmed"),
    ).rejects.toThrow(CheckInError);

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(2);
  });

  test("streak habits check in without touching the ledger", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.streakHabit.id,
    });
    // No currency at stake → no parent confirmation needed.
    expect(created.status).toBe("confirmed");

    const txs = await ctx.db.select().from(schema.starTransactions);
    expect(txs.length).toBe(0);
  });

  test("auto-confirm sweeps only stale pending check-ins", async () => {
    const stale = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    // Second pending check-in on another stars habit, kept fresh.
    const [habit2] = await ctx.db
      .insert(schema.habits)
      .values({
        planId: ctx.plan.id,
        name: "练琴",
        scheduleType: "daily",
        rewardMode: "stars",
        starsPerCompletion: 3,
      })
      .returning();
    await checkIn(ctx.db, ctx.childSession, { habitId: habit2.id });

    // Backdate the first check-in past the 48h window.
    await ctx.db
      .update(schema.checkIns)
      .set({ createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) })
      .where(eq(schema.checkIns.id, stale.id));

    const swept = await sweepAutoConfirm(ctx.db, ctx.child.id);
    expect(swept).toBe(1);

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(2); // stale settled
    expect(balance.pending).toBe(3); // fresh untouched

    const [sweptCheckIn] = await ctx.db
      .select()
      .from(schema.checkIns)
      .where(eq(schema.checkIns.id, stale.id));
    expect(sweptCheckIn.autoConfirmed).toBe(true);
    const [sweptTx] = await ctx.db
      .select()
      .from(schema.starTransactions)
      .where(eq(schema.starTransactions.checkInId, stale.id));
    expect(sweptTx.autoConfirmed).toBe(true);
    expect(sweptTx.status).toBe("confirmed");
  });

  test("co_authored child cannot self-confirm; autonomous child can", async () => {
    const first = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    await expect(
      decideCheckIn(ctx.db, ctx.childSession, first.id, "confirmed"),
    ).rejects.toThrow(AuthzError);

    // The growth lever: bump the stage, rights shift — no migration.
    await ctx.db
      .update(schema.users)
      .set({ stage: "autonomous" })
      .where(eq(schema.users.id, ctx.child.id));

    await decideCheckIn(ctx.db, ctx.childSession, first.id, "confirmed");
    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(2);
  });

  test("a child cannot check in on a sibling's habit", async () => {
    const [sibling] = await ctx.db
      .insert(schema.users)
      .values({
        familyId: ctx.family.id,
        role: "child",
        name: "弟弟",
        pinHash: "x",
        stage: "co_authored",
      })
      .returning();
    const siblingSession: Session = {
      userId: sibling.id,
      familyId: ctx.family.id,
      role: "child",
      name: sibling.name,
    };
    await expect(
      checkIn(ctx.db, siblingSession, { habitId: ctx.starHabit.id }),
    ).rejects.toThrow(AuthzError);
  });

  test("a guardian from another family cannot confirm", async () => {
    const created = await checkIn(ctx.db, ctx.childSession, {
      habitId: ctx.starHabit.id,
    });
    const [otherFamily] = await ctx.db
      .insert(schema.families)
      .values({ name: "别人家", code: "OTHER" })
      .returning();
    const [otherGuardian] = await ctx.db
      .insert(schema.users)
      .values({
        familyId: otherFamily.id,
        role: "guardian",
        name: "路人",
        email: "x@other",
        passwordHash: "x",
      })
      .returning();
    const otherSession: Session = {
      userId: otherGuardian.id,
      familyId: otherFamily.id,
      role: "guardian",
      name: otherGuardian.name,
    };
    await expect(
      decideCheckIn(ctx.db, otherSession, created.id, "confirmed"),
    ).rejects.toThrow(AuthzError);
  });

  test("pendingForFamily lists the confirmation queue", async () => {
    await checkIn(ctx.db, ctx.childSession, { habitId: ctx.starHabit.id });
    const queue = await pendingForFamily(ctx.db, ctx.family.id);
    expect(queue.length).toBe(1);
    expect(queue[0].habit.name).toBe("刷牙");
    expect(queue[0].child.name).toBe("孩子");
  });
});
