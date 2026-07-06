// Redemption + reservation invariants: while a request is open its cost is
// reserved — further requests must fit in confirmed − reserved.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "../src/db/schema";
import type { Session } from "../src/lib/auth/token";
import { AuthzError } from "../src/lib/authz";
import { checkIn } from "../src/server/services/checkins";
import { getBalance } from "../src/server/services/ledger";
import {
  cancelRedemption,
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
    url: `file:${path.join(TMP_DIR, `redemption-${++dbCount}.db`)}`,
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

  // Give the child 10 confirmed stars via a guardian direct log.
  await checkIn(db, guardianSession, { habitId: habit.id });

  const reward = await createReward(db, guardianSession, {
    name: "冰淇淋",
    emoji: "🍦",
    costStars: 6,
  });

  return { db, family, guardian, child, reward, guardianSession, childSession };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

describe("redemption reservations", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  test("request reserves stars without spending them", async () => {
    await requestRedemption(ctx.db, ctx.childSession, ctx.reward.id);
    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(10);
    expect(balance.reserved).toBe(6);
    expect(balance.available).toBe(4);
  });

  test("a second request must fit within available, not confirmed", async () => {
    await requestRedemption(ctx.db, ctx.childSession, ctx.reward.id);
    // 4 available < 6 cost, even though confirmed (10) would cover it.
    await expect(
      requestRedemption(ctx.db, ctx.childSession, ctx.reward.id),
    ).rejects.toThrow(RedemptionError);
  });

  test("approval spends the stars atomically", async () => {
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      ctx.reward.id,
    );
    await decideRedemption(ctx.db, ctx.guardianSession, request.id, "approved");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(4);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(4);
  });

  test("rejection frees the reservation and spends nothing", async () => {
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      ctx.reward.id,
    );
    await decideRedemption(ctx.db, ctx.guardianSession, request.id, "rejected");

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(10);
    expect(balance.reserved).toBe(0);
  });

  test("cancel frees the reservation", async () => {
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      ctx.reward.id,
    );
    await cancelRedemption(ctx.db, ctx.childSession, request.id);
    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.reserved).toBe(0);
  });

  test("a decision settles exactly once", async () => {
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      ctx.reward.id,
    );
    await decideRedemption(ctx.db, ctx.guardianSession, request.id, "approved");
    await expect(
      decideRedemption(ctx.db, ctx.guardianSession, request.id, "approved"),
    ).rejects.toThrow(RedemptionError);

    const balance = await getBalance(ctx.db, ctx.child.id);
    expect(balance.confirmed).toBe(4); // spent once, not twice
  });

  test("children cannot approve redemptions at co_authored stage", async () => {
    const request = await requestRedemption(
      ctx.db,
      ctx.childSession,
      ctx.reward.id,
    );
    await expect(
      decideRedemption(ctx.db, ctx.childSession, request.id, "approved"),
    ).rejects.toThrow(AuthzError);
  });

  test("guardians cannot request redemptions for the child", async () => {
    await expect(
      requestRedemption(ctx.db, ctx.guardianSession, ctx.reward.id),
    ).rejects.toThrow(AuthzError);
  });
});
