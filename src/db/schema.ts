import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
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

// The habit-activity stream, separate from the star ledger: streak/none
// habits produce check-ins but no stars, and streaks are derived from
// check-ins on read. A stars-mode check-in gets a 1:1 linked transaction.
export const checkIns = sqliteTable(
  "check_ins",
  {
    id: id(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id),
    // Denormalized for ledger queries and family scoping.
    childId: text("child_id")
      .notNull()
      .references(() => users.id),
    date: text("date").notNull(), // YYYY-MM-DD, family TZ
    status: text("status", { enum: ["pending", "confirmed", "rejected"] })
      .notNull()
      .default("pending"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    confirmedById: text("confirmed_by_id").references(() => users.id),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    autoConfirmed: integer("auto_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    // Idempotency: one check-in per habit per day. Two guardians (or the
    // child plus a guardian) can't double-log the same completion.
    uniqueIndex("check_ins_habit_date_unique").on(t.habitId, t.date),
    index("check_ins_child_date_idx").on(t.childId, t.date),
  ],
);

export const TRANSACTION_TYPES = [
  "earn",
  "bonus",
  "penalty",
  "redeem",
  "reversal",
  "adjust",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// The Star Ledger. Owned by the CHILD, continuous across plan years.
// Immutable: amounts and types are never UPDATEd — corrections are new
// reversal/adjust rows. Balance = SUM(amount) WHERE status='confirmed'.
// Only src/server/services/ledger.ts may write here.
export const starTransactions = sqliteTable(
  "star_transactions",
  {
    id: id(),
    childId: text("child_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
    // Signed: earn/bonus > 0, penalty/redeem < 0 (see CHECKs).
    amount: integer("amount").notNull(),
    // Only `earn` is ever pending (awaiting guardian confirmation).
    status: text("status", { enum: ["pending", "confirmed", "rejected"] })
      .notNull()
      .default("confirmed"),
    // Optional provenance references.
    checkInId: text("check_in_id").references(() => checkIns.id),
    habitId: text("habit_id").references(() => habits.id),
    goalId: text("goal_id").references(() => goals.id),
    planId: text("plan_id").references(() => plans.id),
    redemptionId: text("redemption_id").references(() => redemptions.id),
    ruleId: text("rule_id").references(() => penaltyRules.id),
    reversesId: text("reverses_id").references(
      (): AnySQLiteColumn => starTransactions.id,
    ),
    occurredOn: text("occurred_on").notNull(), // YYYY-MM-DD, family TZ
    note: text("note"),
    createdById: text("created_by_id").references(() => users.id),
    confirmedById: text("confirmed_by_id").references(() => users.id),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    autoConfirmed: integer("auto_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("star_tx_check_in_unique").on(t.checkInId),
    // A transaction can be reversed at most once.
    uniqueIndex("star_tx_reverses_unique").on(t.reversesId),
    // Idempotency backstop under check_ins' uniqueness.
    uniqueIndex("star_tx_earn_once_per_day")
      .on(t.childId, t.habitId, t.occurredOn)
      .where(sql`${t.type} = 'earn'`),
    index("star_tx_child_idx").on(t.childId, t.createdAt),
    check(
      "star_tx_positive_types",
      sql`${t.type} NOT IN ('earn', 'bonus') OR ${t.amount} > 0`,
    ),
    check(
      "star_tx_negative_types",
      sql`${t.type} NOT IN ('penalty', 'redeem') OR ${t.amount} < 0`,
    ),
    check(
      "star_tx_penalty_needs_rule",
      sql`${t.type} != 'penalty' OR (${t.ruleId} IS NOT NULL AND ${t.note} IS NOT NULL)`,
    ),
    check(
      "star_tx_reversal_needs_target",
      sql`${t.type} != 'reversal' OR ${t.reversesId} IS NOT NULL`,
    ),
    check(
      "star_tx_redeem_needs_redemption",
      sql`${t.type} != 'redeem' OR ${t.redemptionId} IS NOT NULL`,
    ),
  ],
);

// Pre-agreed written rules — the only legitimate source of penalties.
// The description is the family's written agreement; maxStars caps each
// infraction so a bad evening can't wipe out weeks of earning.
export const penaltyRules = sqliteTable("penalty_rules", {
  id: id(),
  childId: text("child_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  maxStars: integer("max_stars").notNull().default(1),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  agreedAt: integer("agreed_at", { mode: "timestamp_ms" }),
  createdById: text("created_by_id").references(() => users.id),
  createdAt: createdAt(),
});

export const rewards = sqliteTable("rewards", {
  id: id(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎁"),
  description: text("description"),
  costStars: integer("cost_stars").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

// While status='requested', costStars counts as RESERVED: penalties can't
// touch it and further requests must fit in balance − reserved.
export const redemptions = sqliteTable("redemptions", {
  id: id(),
  childId: text("child_id")
    .notNull()
    .references(() => users.id),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id),
  // Price snapshot at request time; catalog prices may change later.
  costStars: integer("cost_stars").notNull(),
  status: text("status", {
    enum: ["requested", "approved", "rejected", "canceled"],
  })
    .notNull()
    .default("requested"),
  note: text("note"),
  requestedAt: createdAt(),
  decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
  decidedById: text("decided_by_id").references(() => users.id),
});

export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    id: id(),
    childId: text("child_id")
      .notNull()
      .references(() => users.id),
    weekStart: text("week_start").notNull(), // Monday, YYYY-MM-DD
    planId: text("plan_id").references(() => plans.id),
    parentNote: text("parent_note"),
    childNote: text("child_note"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("weekly_reviews_child_week").on(t.childId, t.weekStart)],
);

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type CheckIn = typeof checkIns.$inferSelect;
export type StarTransaction = typeof starTransactions.$inferSelect;
export type PenaltyRule = typeof penaltyRules.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;
export type WeeklyReview = typeof weeklyReviews.$inferSelect;
