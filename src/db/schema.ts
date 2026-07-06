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

export type Family = typeof families.$inferSelect;
export type User = typeof users.$inferSelect;
