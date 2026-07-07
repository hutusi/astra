// Dev/onboarding seed. Wipes and recreates the demo family — refuses to run
// against a remote database unless SEED_FORCE=1 (first-time prod setup).
// Runs under the Bun runtime: bun run seed
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import {
  checkIns,
  families,
  goals,
  habits,
  penaltyRules,
  plans,
  redemptions,
  rewards,
  starTransactions,
  users,
  weeklyReviews,
} from "../src/db/schema";
import { getDatabaseUrl } from "../src/db/url";

const url = getDatabaseUrl();
const isRemote = !url.startsWith("file:");
if (isRemote && process.env.SEED_FORCE !== "1") {
  console.error(
    `Refusing to seed remote database (${url}). Set SEED_FORCE=1 to override.`,
  );
  process.exit(1);
}
// Never plant the well-known dev credentials in a live database.
if (isRemote && (!process.env.SEED_PARENT_PASSWORD || !process.env.SEED_CHILD_PIN)) {
  console.error(
    "Remote seeding requires explicit SEED_PARENT_PASSWORD and SEED_CHILD_PIN.",
  );
  process.exit(1);
}

const PARENT_PASSWORD = process.env.SEED_PARENT_PASSWORD ?? "astra-dev";
const CHILD_PIN = process.env.SEED_CHILD_PIN ?? "1234";

async function seed() {
  // FK dependency order: ledger first, principals last.
  await db.delete(starTransactions);
  await db.delete(redemptions);
  await db.delete(checkIns);
  await db.delete(weeklyReviews);
  await db.delete(penaltyRules);
  await db.delete(rewards);
  await db.delete(goals);
  await db.delete(habits);
  await db.delete(plans);
  await db.delete(users);
  await db.delete(families);

  const [family] = await db
    .insert(families)
    .values({ name: "星河之家", code: "ASTRA", timezone: "Asia/Shanghai" })
    .returning();

  const passwordHash = await bcrypt.hash(PARENT_PASSWORD, 10);
  const pinHash = await bcrypt.hash(CHILD_PIN, 10);

  const inserted = await db
    .insert(users)
    .values([
      {
        familyId: family.id,
        role: "guardian",
        name: "爸爸",
        avatar: "👨",
        email: "papa@astra.family",
        passwordHash,
      },
      {
        familyId: family.id,
        role: "guardian",
        name: "妈妈",
        avatar: "👩",
        email: "mama@astra.family",
        passwordHash,
      },
      {
        familyId: family.id,
        role: "child",
        name: "小星",
        avatar: "🦖",
        pinHash,
        stage: "co_authored",
        birthdate: "2015-01-01",
      },
    ])
    .returning();
  const child = inserted.find((u) => u.role === "child")!;

  const year = new Date().getFullYear();
  const [plan] = await db
    .insert(plans)
    .values({
      childId: child.id,
      name: `${year} 年度星图`,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      stageAtCreation: "co_authored",
      status: "active",
    })
    .returning();

  await db.insert(habits).values([
    {
      planId: plan.id,
      name: "睡前刷牙",
      emoji: "🦷",
      scheduleType: "daily",
      rewardMode: "stars",
      starsPerCompletion: 1,
      sortOrder: 1,
    },
    {
      planId: plan.id,
      name: "户外跑步",
      emoji: "🏃",
      scheduleType: "weekly_days",
      scheduleDays: JSON.stringify([2, 4, 6]),
      rewardMode: "stars",
      starsPerCompletion: 2,
      sortOrder: 2,
    },
    {
      planId: plan.id,
      name: "练琴",
      emoji: "🎹",
      scheduleType: "x_per_week",
      timesPerWeek: 4,
      rewardMode: "stars",
      starsPerCompletion: 2,
      sortOrder: 3,
    },
    {
      // Intrinsically-loved activity: tracked as a streak, never paid.
      planId: plan.id,
      name: "自由阅读",
      emoji: "📖",
      scheduleType: "daily",
      rewardMode: "streak",
      starsPerCompletion: 0,
      sortOrder: 4,
    },
  ]);

  await db.insert(goals).values([
    {
      planId: plan.id,
      name: "学会自由泳",
      bonusStars: 50,
      targetDate: `${year}-08-31`,
    },
    { planId: plan.id, name: "读完 20 本书", bonusStars: 30 },
  ]);

  // Economy anchor: one good week (~15-20 stars) ≈ one small reward.
  await db.insert(rewards).values([
    { familyId: family.id, name: "冰淇淋一个", emoji: "🍦", costStars: 15 },
    { familyId: family.id, name: "游戏时间 1 小时", emoji: "🎮", costStars: 20 },
    { familyId: family.id, name: "周末电影之夜", emoji: "🎬", costStars: 60 },
  ]);

  const shownPassword = isRemote ? "(from env)" : PARENT_PASSWORD;
  const shownPin = isRemote ? "(from env)" : CHILD_PIN;
  console.log(`Seeded family 星河之家 (code: ASTRA)
  guardian: papa@astra.family / ${shownPassword}
  guardian: mama@astra.family / ${shownPassword}
  child:    小星 (stage co_authored, PIN ${shownPin})
  plan:     ${plan.name} · 4 habits · 2 goals`);
}

await seed();
process.exit(0);
