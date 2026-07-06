import { sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

// Astra schema. Tables land slice by slice; see docs/DESIGN.md.

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => nanoid());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const STAGES = [
  "parent_led",
  "co_authored",
  "child_led",
  "autonomous",
] as const;
export type Stage = (typeof STAGES)[number];

export const families = sqliteTable("families", {
  id: id(),
  name: text("name").notNull(),
  // Short slug the child types to log in.
  code: text("code").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: id(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    role: text("role", { enum: ["guardian", "child"] }).notNull(),
    name: text("name").notNull(),
    avatar: text("avatar").notNull().default("⭐"),
    locale: text("locale", { enum: ["zh", "en"] }).notNull().default("zh"),
    // Guardian-only.
    email: text("email"),
    passwordHash: text("password_hash"),
    // Child-only. `stage` drives the permission matrix (src/lib/authz.ts) and
    // lives on the child, not the plan, so a mid-year transition is a
    // settings change.
    pinHash: text("pin_hash"),
    stage: text("stage", { enum: STAGES }),
    birthdate: text("birthdate"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique")
      .on(t.email)
      .where(sql`${t.email} IS NOT NULL`),
    uniqueIndex("users_family_name_unique").on(t.familyId, t.name),
    check(
      "users_guardian_has_email",
      sql`${t.role} != 'guardian' OR ${t.email} IS NOT NULL`,
    ),
    check(
      "users_child_has_stage",
      sql`${t.role} != 'child' OR ${t.stage} IS NOT NULL`,
    ),
  ],
);

export const plans = sqliteTable(
  "plans",
  {
    id: id(),
    // Plans belong to the CHILD (the ledger does too) — they are yearly
    // containers that come and go while the child's data continues.
    childId: text("child_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    periodStart: text("period_start").notNull(), // YYYY-MM-DD, family TZ
    periodEnd: text("period_end").notNull(),
    // Snapshot of the child's stage when the plan was authored; permission
    // checks always use the child's CURRENT stage instead.
    stageAtCreation: text("stage_at_creation", { enum: STAGES }).notNull(),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("plans_one_active_per_child")
      .on(t.childId)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const SCHEDULE_TYPES = ["daily", "weekly_days", "x_per_week"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

// The growth lever: `stars` habits pay currency, `streak` habits track
// chains only, `none` habits are just observed. Moving a habit between
// modes is how star-rewards fade as the child matures — config, not
// migration. It also keeps intrinsically-motivating activities unpaid.
export const REWARD_MODES = ["stars", "streak", "none"] as const;
export type RewardMode = (typeof REWARD_MODES)[number];

export const habits = sqliteTable("habits", {
  id: id(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("⭐"),
  description: text("description"),
  scheduleType: text("schedule_type", { enum: SCHEDULE_TYPES })
    .notNull()
    .default("daily"),
  // JSON array of ISO weekday numbers (Mon=1..Sun=7); weekly_days only.
  scheduleDays: text("schedule_days"),
  timesPerWeek: integer("times_per_week"), // x_per_week only
  rewardMode: text("reward_mode", { enum: REWARD_MODES })
    .notNull()
    .default("stars"),
  starsPerCompletion: integer("stars_per_completion").notNull().default(1),
  status: text("status", { enum: ["active", "paused", "archived"] })
    .notNull()
    .default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
});

export const goals = sqliteTable("goals", {
  id: id(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  name: text("name").notNull(),
  description: text("description"),
  bonusStars: integer("bonus_stars").notNull().default(0),
  targetDate: text("target_date"),
  status: text("status", { enum: ["active", "completed", "abandoned"] })
    .notNull()
    .default("active"),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  completedById: text("completed_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type Goal = typeof goals.$inferSelect;
