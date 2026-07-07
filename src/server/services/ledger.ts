// THE single writer of star_transactions. No other module may INSERT or
// UPDATE ledger rows — that boundary, not the schema, is what makes the
// ledger trustworthy. Amounts/types are never UPDATEd; corrections are new
// reversal/adjust rows. Only `earn` rows ever have status transitions
// (pending → confirmed | rejected), performed here.
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  families,
  penaltyRules,
  redemptions,
  starTransactions,
  type StarTransaction,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";
import { todayIn } from "@/lib/dates";

export class LedgerError extends Error {
  constructor(
    public code:
      | "notFound"
      | "ruleInactive"
      | "nothingToDeduct"
      | "wouldGoNegative"
      | "alreadyReversed"
      | "notReversible"
      | "noteRequired"
      | "zeroAmount",
  ) {
    super(code);
    this.name = "LedgerError";
  }
}

// Drizzle transaction handle — same query interface as Db.
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export type Balance = {
  confirmed: number;
  pending: number;
  reserved: number;
  available: number; // confirmed − reserved
};

export async function getBalance(db: DbOrTx, childId: string): Promise<Balance> {
  const [sums] = await db
    .select({
      confirmed:
        sql<number>`coalesce(sum(case when ${starTransactions.status} = 'confirmed' then ${starTransactions.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
      pending:
        sql<number>`coalesce(sum(case when ${starTransactions.status} = 'pending' then ${starTransactions.amount} else 0 end), 0)`.mapWith(
          Number,
        ),
    })
    .from(starTransactions)
    .where(eq(starTransactions.childId, childId));

  const reserved = await getReserved(db, childId);
  return {
    confirmed: sums.confirmed,
    pending: sums.pending,
    reserved,
    available: sums.confirmed - reserved,
  };
}

/** Stars held by open redemption requests — untouchable by penalties. */
export async function getReserved(
  db: DbOrTx,
  childId: string,
): Promise<number> {
  const [row] = await db
    .select({
      reserved:
        sql<number>`coalesce(sum(${redemptions.costStars}), 0)`.mapWith(Number),
    })
    .from(redemptions)
    .where(
      and(eq(redemptions.childId, childId), eq(redemptions.status, "requested")),
    );
  return row.reserved;
}

export async function listTransactions(
  db: Db,
  childId: string,
  limit = 50,
): Promise<StarTransaction[]> {
  return db.query.starTransactions.findMany({
    where: eq(starTransactions.childId, childId),
    orderBy: [desc(starTransactions.createdAt), desc(starTransactions.id)],
    limit,
  });
}

// ---------------------------------------------------------------------------
// Write helpers. Callers (checkins/redemptions/goals services) invoke these
// inside their own db.transaction so the business record and its ledger row
// commit atomically.

export async function insertEarn(
  tx: DbOrTx,
  input: {
    childId: string;
    habitId: string;
    checkInId: string;
    planId: string;
    amount: number;
    occurredOn: string;
    createdById: string;
    status: "pending" | "confirmed";
  },
): Promise<void> {
  await tx.insert(starTransactions).values({
    childId: input.childId,
    type: "earn",
    amount: input.amount,
    status: input.status,
    checkInId: input.checkInId,
    habitId: input.habitId,
    planId: input.planId,
    occurredOn: input.occurredOn,
    createdById: input.createdById,
    confirmedById: input.status === "confirmed" ? input.createdById : null,
    confirmedAt: input.status === "confirmed" ? new Date() : null,
  });
}

/** Settle the pending earn linked to a check-in. No-op if none/settled. */
export async function settleEarnForCheckIn(
  tx: DbOrTx,
  checkInId: string,
  decision: "confirmed" | "rejected",
  confirmedById: string | null,
  autoConfirmed = false,
): Promise<void> {
  await tx
    .update(starTransactions)
    .set({
      status: decision,
      confirmedById,
      confirmedAt: new Date(),
      autoConfirmed,
    })
    .where(
      and(
        eq(starTransactions.checkInId, checkInId),
        eq(starTransactions.status, "pending"),
      ),
    );
}

/** Redeem transaction — always confirmed; caller guards the balance. */
export async function insertRedeem(
  tx: DbOrTx,
  input: {
    childId: string;
    redemptionId: string;
    cost: number;
    note: string;
    occurredOn: string;
    createdById: string;
  },
): Promise<void> {
  await tx.insert(starTransactions).values({
    childId: input.childId,
    type: "redeem",
    amount: -Math.abs(input.cost),
    status: "confirmed",
    redemptionId: input.redemptionId,
    note: input.note,
    occurredOn: input.occurredOn,
    createdById: input.createdById,
    confirmedById: input.createdById,
    confirmedAt: new Date(),
  });
}

/** Pending earns older than the cutoff, for the auto-confirm sweep. */
export async function pendingEarnsBefore(
  db: DbOrTx,
  childId: string,
  cutoff: Date,
): Promise<StarTransaction[]> {
  return db
    .select()
    .from(starTransactions)
    .where(
      and(
        eq(starTransactions.childId, childId),
        eq(starTransactions.status, "pending"),
        lt(starTransactions.createdAt, cutoff),
      ),
    );
}

async function occurredToday(db: DbOrTx, familyId: string): Promise<string> {
  const family = await db.query.families.findFirst({
    where: eq(families.id, familyId),
    columns: { timezone: true },
  });
  return todayIn(family?.timezone ?? "Asia/Shanghai");
}

/**
 * Guarded penalty: only from a pre-agreed active rule, capped by the rule,
 * reason required, clamped so it can never touch reserved stars or push the
 * balance negative. Refused outright when nothing is deductible — the
 * child's savings toward a requested reward are untouchable.
 */
export async function recordPenalty(
  db: Db,
  session: Session,
  input: { childId: string; ruleId: string; note: string },
): Promise<StarTransaction> {
  await assertCan(db, session, "penalty.create", input.childId);
  if (!input.note.trim()) throw new LedgerError("noteRequired");

  const rule = await db.query.penaltyRules.findFirst({
    where: and(
      eq(penaltyRules.id, input.ruleId),
      eq(penaltyRules.childId, input.childId),
    ),
  });
  if (!rule) throw new LedgerError("notFound");
  if (!rule.active) throw new LedgerError("ruleInactive");

  const occurredOn = await occurredToday(db, session.familyId);

  return db.transaction(async (tx) => {
    const balance = await getBalance(tx, input.childId);
    const deductible = Math.min(rule.maxStars, balance.available);
    if (deductible <= 0) throw new LedgerError("nothingToDeduct");

    const [penalty] = await tx
      .insert(starTransactions)
      .values({
        childId: input.childId,
        type: "penalty",
        amount: -deductible,
        status: "confirmed",
        ruleId: rule.id,
        note: input.note.trim(),
        occurredOn,
        createdById: session.userId,
        confirmedById: session.userId,
        confirmedAt: new Date(),
      })
      .returning();
    return penalty;
  });
}

/**
 * Guardian manual correction; note required, balance floors at zero.
 * Deliberately allowed to dip into RESERVED stars (unlike penalties):
 * adjust is the escape hatch for real mistakes, and the balance re-check
 * at redemption approval keeps the ledger invariant safe regardless.
 */
export async function recordAdjust(
  db: Db,
  session: Session,
  input: { childId: string; amount: number; note: string },
): Promise<StarTransaction> {
  await assertCan(db, session, "ledger.adjust", input.childId);
  if (!input.note.trim()) throw new LedgerError("noteRequired");
  const amount = Math.trunc(input.amount);
  if (amount === 0) throw new LedgerError("zeroAmount");

  const occurredOn = await occurredToday(db, session.familyId);

  return db.transaction(async (tx) => {
    if (amount < 0) {
      const balance = await getBalance(tx, input.childId);
      if (balance.confirmed + amount < 0) {
        throw new LedgerError("wouldGoNegative");
      }
    }
    const [adjust] = await tx
      .insert(starTransactions)
      .values({
        childId: input.childId,
        type: "adjust",
        amount,
        status: "confirmed",
        note: input.note.trim(),
        occurredOn,
        createdById: session.userId,
        confirmedById: session.userId,
        confirmedAt: new Date(),
      })
      .returning();
    return adjust;
  });
}

/**
 * Exact negation of a confirmed transaction, at most once (unique index on
 * reversesId). Refused if it would push the balance negative — use adjust
 * for partial corrections instead.
 */
export async function reverseTransaction(
  db: Db,
  session: Session,
  transactionId: string,
  note?: string,
): Promise<StarTransaction> {
  const original = await db.query.starTransactions.findFirst({
    where: eq(starTransactions.id, transactionId),
  });
  if (!original) throw new LedgerError("notFound");
  await assertCan(db, session, "ledger.reverse", original.childId);
  if (original.status !== "confirmed" || original.type === "reversal") {
    throw new LedgerError("notReversible");
  }

  const occurredOn = await occurredToday(db, session.familyId);

  try {
    return await db.transaction(async (tx) => {
      if (original.amount > 0) {
        const balance = await getBalance(tx, original.childId);
        if (balance.confirmed - original.amount < 0) {
          throw new LedgerError("wouldGoNegative");
        }
      }
      const [reversal] = await tx
        .insert(starTransactions)
        .values({
          childId: original.childId,
          type: "reversal",
          amount: -original.amount,
          status: "confirmed",
          reversesId: original.id,
          note: note?.trim() || null,
          occurredOn,
          createdById: session.userId,
          confirmedById: session.userId,
          confirmedAt: new Date(),
        })
        .returning();
      return reversal;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed|SQLITE_CONSTRAINT/.test(
        `${error.message} ${(error.cause as Error | undefined)?.message ?? ""}`,
      )
    ) {
      throw new LedgerError("alreadyReversed");
    }
    throw error;
  }
}

/** Bonus stars (e.g. goal completion). Caller supplies provenance. */
export async function insertBonus(
  tx: DbOrTx,
  input: {
    childId: string;
    amount: number;
    note: string;
    goalId?: string;
    planId?: string;
    occurredOn: string;
    createdById: string;
  },
): Promise<void> {
  await tx.insert(starTransactions).values({
    childId: input.childId,
    type: "bonus",
    amount: Math.abs(input.amount),
    status: "confirmed",
    goalId: input.goalId ?? null,
    planId: input.planId ?? null,
    note: input.note,
    occurredOn: input.occurredOn,
    createdById: input.createdById,
    confirmedById: input.createdById,
    confirmedAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Penalty rules — the written agreements penalties must cite.

export async function listPenaltyRules(db: Db, childId: string) {
  return db.query.penaltyRules.findMany({
    where: eq(penaltyRules.childId, childId),
    orderBy: (r, { asc }) => [asc(r.createdAt)],
  });
}

export async function createPenaltyRule(
  db: Db,
  session: Session,
  input: {
    childId: string;
    title: string;
    description?: string;
    maxStars: number;
  },
) {
  await assertCan(db, session, "penalty.create", input.childId);
  const [rule] = await db
    .insert(penaltyRules)
    .values({
      childId: input.childId,
      title: input.title,
      description: input.description || null,
      maxStars: Math.max(1, input.maxStars),
      agreedAt: new Date(),
      createdById: session.userId,
    })
    .returning();
  return rule;
}

export async function updatePenaltyRule(
  db: Db,
  session: Session,
  ruleId: string,
  input: {
    title: string;
    description?: string;
    maxStars: number;
    active: boolean;
  },
) {
  const rule = await db.query.penaltyRules.findFirst({
    where: eq(penaltyRules.id, ruleId),
    columns: { childId: true },
  });
  if (!rule) throw new LedgerError("notFound");
  await assertCan(db, session, "penalty.create", rule.childId);
  await db
    .update(penaltyRules)
    .set({
      title: input.title,
      description: input.description || null,
      maxStars: Math.max(1, input.maxStars),
      active: input.active,
    })
    .where(eq(penaltyRules.id, ruleId));
}
