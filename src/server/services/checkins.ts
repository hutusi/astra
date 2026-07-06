// The core loop: child self-reports → pending stars → guardian confirms →
// (or a 48h lazy auto-confirm settles it so busy parents never starve the
// child of feedback).
import { and, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import type { Db } from "@/db";
import {
  checkIns,
  families,
  habits,
  plans,
  users,
  type CheckIn,
  type Habit,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";
import { todayIn } from "@/lib/dates";
import { insertEarn, settleEarnForCheckIn } from "./ledger";

const AUTO_CONFIRM_MS = 48 * 60 * 60 * 1000;

export class CheckInError extends Error {
  constructor(
    public code:
      | "alreadyDone"
      | "notFound"
      | "habitInactive"
      | "invalidDate"
      | "notPending",
  ) {
    super(code);
    this.name = "CheckInError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT/.test(
      `${error.message} ${(error.cause as Error | undefined)?.message ?? ""}`,
    )
  );
}

export async function checkIn(
  db: Db,
  session: Session,
  input: { habitId: string; date?: string; note?: string },
): Promise<CheckIn> {
  const habit = await db.query.habits.findFirst({
    where: eq(habits.id, input.habitId),
  });
  if (!habit) throw new CheckInError("notFound");
  if (habit.status !== "active") throw new CheckInError("habitInactive");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, habit.planId),
    columns: { id: true, childId: true },
  });
  if (!plan) throw new CheckInError("notFound");

  const isChild = session.role === "child";
  await assertCan(
    db,
    session,
    isChild ? "checkin.self" : "checkin.direct_log",
    plan.childId,
  );

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
    columns: { timezone: true },
  });
  const today = todayIn(family?.timezone ?? "Asia/Shanghai");
  const date = input.date ?? today;
  // Children log today only; guardians may backdate but never future-date.
  if (isChild ? date !== today : date > today) {
    throw new CheckInError("invalidDate");
  }

  // Child star-earning check-ins await confirmation; guardian direct logs
  // and non-currency (streak/none) habits settle immediately — parent
  // confirmation exists to guard the currency, not to gate every tap.
  const status: "pending" | "confirmed" =
    isChild && habit.rewardMode === "stars" ? "pending" : "confirmed";

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(checkIns)
        .values({
          habitId: habit.id,
          childId: plan.childId,
          date,
          status,
          createdById: session.userId,
          confirmedById: status === "confirmed" ? session.userId : null,
          confirmedAt: status === "confirmed" ? new Date() : null,
          note: input.note || null,
        })
        .returning();

      if (habit.rewardMode === "stars") {
        await insertEarn(tx, {
          childId: plan.childId,
          habitId: habit.id,
          checkInId: created.id,
          planId: plan.id,
          amount: habit.starsPerCompletion,
          occurredOn: date,
          createdById: session.userId,
          status,
        });
      }
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new CheckInError("alreadyDone");
    throw error;
  }
}

export async function decideCheckIn(
  db: Db,
  session: Session,
  checkInId: string,
  decision: "confirmed" | "rejected",
): Promise<void> {
  const existing = await db.query.checkIns.findFirst({
    where: eq(checkIns.id, checkInId),
    columns: { childId: true, status: true },
  });
  if (!existing) throw new CheckInError("notFound");
  await assertCan(db, session, "checkin.confirm", existing.childId);
  if (existing.status !== "pending") throw new CheckInError("notPending");

  await db.transaction(async (tx) => {
    // status guard in WHERE makes concurrent decisions settle exactly once
    const updated = await tx
      .update(checkIns)
      .set({
        status: decision,
        confirmedById: session.userId,
        confirmedAt: new Date(),
      })
      .where(and(eq(checkIns.id, checkInId), eq(checkIns.status, "pending")))
      .returning({ id: checkIns.id });
    if (updated.length === 0) throw new CheckInError("notPending");

    await settleEarnForCheckIn(tx, checkInId, decision, session.userId);
  });
}

/**
 * Lazy 48h auto-confirm — runs at the top of balance-computing reads, so
 * the system needs no cron and degrades gracefully when parents are busy.
 */
export async function sweepAutoConfirm(
  db: Db,
  childId: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_CONFIRM_MS);
  const stale = await db
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.childId, childId),
        eq(checkIns.status, "pending"),
        lt(checkIns.createdAt, cutoff),
      ),
    );
  if (stale.length === 0) return 0;

  const ids = stale.map((row) => row.id);
  await db.transaction(async (tx) => {
    await tx
      .update(checkIns)
      .set({ status: "confirmed", confirmedAt: new Date(), autoConfirmed: true })
      .where(and(inArray(checkIns.id, ids), eq(checkIns.status, "pending")));
    for (const id of ids) {
      await settleEarnForCheckIn(tx, id, "confirmed", null, true);
    }
  });
  return ids.length;
}

export type PendingCheckIn = {
  checkIn: CheckIn;
  habit: Habit;
  child: { id: string; name: string; avatar: string };
};

export async function pendingForFamily(
  db: Db,
  familyId: string,
): Promise<PendingCheckIn[]> {
  const rows = await db
    .select({ checkIn: checkIns, habit: habits, child: users })
    .from(checkIns)
    .innerJoin(habits, eq(checkIns.habitId, habits.id))
    .innerJoin(users, eq(checkIns.childId, users.id))
    .where(and(eq(users.familyId, familyId), eq(checkIns.status, "pending")))
    .orderBy(checkIns.date, checkIns.createdAt);

  return rows.map((row) => ({
    checkIn: row.checkIn,
    habit: row.habit,
    child: { id: row.child.id, name: row.child.name, avatar: row.child.avatar },
  }));
}

/** Check-ins (any status but rejected) for one day — today-view state. */
export async function checkInsForDate(
  db: Db,
  childId: string,
  date: string,
): Promise<CheckIn[]> {
  return db.query.checkIns.findMany({
    where: and(
      eq(checkIns.childId, childId),
      eq(checkIns.date, date),
      ne(checkIns.status, "rejected"),
    ),
  });
}

/** Non-rejected check-ins in [from, to] — weekly quotas, streaks, reviews. */
export async function checkInsBetween(
  db: Db,
  childId: string,
  from: string,
  to: string,
): Promise<CheckIn[]> {
  return db.query.checkIns.findMany({
    where: and(
      eq(checkIns.childId, childId),
      gte(checkIns.date, from),
      lte(checkIns.date, to),
      ne(checkIns.status, "rejected"),
    ),
    orderBy: (c, { asc }) => [asc(c.date)],
  });
}
