// THE single writer of star_transactions. No other module may INSERT or
// UPDATE ledger rows — that boundary, not the schema, is what makes the
// ledger trustworthy. Amounts/types are never UPDATEd; corrections are new
// reversal/adjust rows. Only `earn` rows ever have status transitions
// (pending → confirmed | rejected), performed here.
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { redemptions, starTransactions, type StarTransaction } from "@/db/schema";

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
