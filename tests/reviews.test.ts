// Weekly review: streak math, week stats, note permissions.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as schema from "../src/db/schema";
import type { Session } from "../src/lib/auth/token";
import { mondayOf, todayIn } from "../src/lib/dates";
import { checkIn } from "../src/server/services/checkins";
import {
  currentStreak,
  getReview,
  getWeekStats,
  saveReviewNote,
} from "../src/server/services/reviews";

const MIGRATIONS = path.join(import.meta.dir, "..", "drizzle");
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "astra-test-"));
let dbCount = 0;

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

const TODAY = "2026-07-08"; // a Wednesday
const dailyHabit = {
  scheduleType: "daily",
  scheduleDays: null,
  timesPerWeek: null,
} as schema.Habit;
const weeklyHabit = {
  scheduleType: "weekly_days",
  scheduleDays: JSON.stringify([1, 3, 5]), // Mon/Wed/Fri
  timesPerWeek: null,
} as schema.Habit;
const quotaHabit = {
  scheduleType: "x_per_week",
  scheduleDays: null,
  timesPerWeek: 2,
} as schema.Habit;

describe("currentStreak", () => {
  test("daily: consecutive days ending today", () => {
    const dates = new Set(["2026-07-06", "2026-07-07", "2026-07-08"]);
    expect(currentStreak(dailyHabit, dates, TODAY)).toBe(3);
  });

  test("daily: an unchecked today is forgiven, a missed yesterday breaks", () => {
    expect(
      currentStreak(dailyHabit, new Set(["2026-07-06", "2026-07-07"]), TODAY),
    ).toBe(2);
    expect(currentStreak(dailyHabit, new Set(["2026-07-06"]), TODAY)).toBe(0);
  });

  test("weekly_days: only scheduled days count toward the chain", () => {
    // Mon 7-06 and Wed 7-08 checked; Tue/Thu don't matter. Previous Fri 7-03 checked.
    const dates = new Set(["2026-07-03", "2026-07-06", "2026-07-08"]);
    expect(currentStreak(weeklyHabit, dates, TODAY)).toBe(3);
    // Missing Monday breaks the chain even with Wed checked.
    expect(
      currentStreak(weeklyHabit, new Set(["2026-07-03", "2026-07-08"]), TODAY),
    ).toBe(1);
  });

  test("weekly_days: an empty scheduleDays array returns 0 instead of hanging", () => {
    const emptyDaysHabit = {
      scheduleType: "weekly_days",
      scheduleDays: "[]",
      timesPerWeek: null,
    } as schema.Habit;
    expect(
      currentStreak(emptyDaysHabit, new Set(["2026-07-08"]), TODAY),
    ).toBe(0);
  });

  test("x_per_week: consecutive weeks meeting the quota", () => {
    const dates = new Set([
      // last week: two check-ins (meets 2/week)
      "2026-06-29",
      "2026-07-02",
      // this week so far: two check-ins (meets quota already)
      "2026-07-06",
      "2026-07-07",
    ]);
    expect(currentStreak(quotaHabit, dates, TODAY)).toBe(2);
    // This week not yet met → streak counts completed weeks only.
    expect(
      currentStreak(quotaHabit, new Set(["2026-06-29", "2026-07-02"]), TODAY),
    ).toBe(1);
  });
});

async function setup() {
  const client = createClient({
    url: `file:${path.join(TMP_DIR, `review-${++dbCount}.db`)}`,
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
      starsPerCompletion: 2,
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

  return { db, family, child, habit, guardianSession, childSession };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

describe("week stats and review notes", () => {
  let ctx: Ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  test("stats count the week's check-ins and star flow", async () => {
    const today = todayIn("Asia/Shanghai");
    const weekStart = mondayOf(today);
    // Guardian backdates two logs within the current week (never future).
    await checkIn(ctx.db, ctx.guardianSession, {
      habitId: ctx.habit.id,
      date: weekStart <= today ? weekStart : today,
    });
    if (today !== weekStart) {
      await checkIn(ctx.db, ctx.guardianSession, {
        habitId: ctx.habit.id,
        date: today,
      });
    }

    const stats = await getWeekStats(ctx.db, ctx.child.id, weekStart, today);
    expect(stats).not.toBeNull();
    const expected = today === weekStart ? 1 : 2;
    expect(stats!.habits[0].done).toBe(expected);
    expect(stats!.habits[0].scheduled).toBe(7);
    expect(stats!.starsIn).toBe(expected * 2);
    expect(stats!.starsOut).toBe(0);
  });

  test("both sides write their own note into one review row", async () => {
    const weekStart = mondayOf(todayIn("Asia/Shanghai"));
    await saveReviewNote(ctx.db, ctx.childSession, {
      childId: ctx.child.id,
      weekStart,
      note: "这周我很棒",
    });
    await saveReviewNote(ctx.db, ctx.guardianSession, {
      childId: ctx.child.id,
      weekStart,
      note: "跑步坚持得好",
    });

    const review = await getReview(ctx.db, ctx.child.id, weekStart);
    expect(review?.childNote).toBe("这周我很棒");
    expect(review?.parentNote).toBe("跑步坚持得好");
    expect(review?.completedAt).not.toBeNull();
  });

  test("a child cannot write into a sibling's review", async () => {
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
    const weekStart = mondayOf(todayIn("Asia/Shanghai"));
    await expect(
      saveReviewNote(ctx.db, ctx.childSession, {
        childId: sibling.id,
        weekStart,
        note: "偷写",
      }),
    ).rejects.toThrow();
  });
});
