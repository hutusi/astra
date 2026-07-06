// Rewards catalog + redemption flow. While a request is open its cost is
// RESERVED: further requests must fit in confirmed − reserved, and
// penalties can never raid it (see ledger.getReserved).
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  families,
  redemptions,
  rewards,
  users,
  type Redemption,
  type Reward,
} from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";
import { todayIn } from "@/lib/dates";
import { getBalance, insertRedeem } from "./ledger";

export class RedemptionError extends Error {
  constructor(
    public code: "notFound" | "insufficientStars" | "notRequested" | "inactive",
  ) {
    super(code);
    this.name = "RedemptionError";
  }
}

export type RewardInput = {
  name: string;
  emoji: string;
  description?: string;
  costStars: number;
  active?: boolean;
};

export async function listRewards(
  db: Db,
  familyId: string,
  onlyActive = false,
): Promise<Reward[]> {
  return db.query.rewards.findMany({
    where: onlyActive
      ? and(eq(rewards.familyId, familyId), eq(rewards.active, true))
      : eq(rewards.familyId, familyId),
    orderBy: [asc(rewards.costStars), asc(rewards.createdAt)],
  });
}

export async function createReward(
  db: Db,
  session: Session,
  input: RewardInput,
): Promise<Reward> {
  await assertCan(db, session, "reward.manage");
  const [reward] = await db
    .insert(rewards)
    .values({
      familyId: session.familyId,
      name: input.name,
      emoji: input.emoji,
      description: input.description || null,
      costStars: Math.max(1, input.costStars),
      active: input.active ?? true,
    })
    .returning();
  return reward;
}

export async function updateReward(
  db: Db,
  session: Session,
  rewardId: string,
  input: RewardInput,
): Promise<void> {
  await assertCan(db, session, "reward.manage");
  await db
    .update(rewards)
    .set({
      name: input.name,
      emoji: input.emoji,
      description: input.description || null,
      costStars: Math.max(1, input.costStars),
      active: input.active ?? true,
    })
    .where(
      and(eq(rewards.id, rewardId), eq(rewards.familyId, session.familyId)),
    );
}

export async function requestRedemption(
  db: Db,
  session: Session,
  rewardId: string,
): Promise<Redemption> {
  await assertCan(db, session, "redemption.request", session.userId);

  const reward = await db.query.rewards.findFirst({
    where: and(eq(rewards.id, rewardId), eq(rewards.familyId, session.familyId)),
  });
  if (!reward) throw new RedemptionError("notFound");
  if (!reward.active) throw new RedemptionError("inactive");

  return db.transaction(async (tx) => {
    const balance = await getBalance(tx, session.userId);
    if (balance.available < reward.costStars) {
      throw new RedemptionError("insufficientStars");
    }
    const [request] = await tx
      .insert(redemptions)
      .values({
        childId: session.userId,
        rewardId: reward.id,
        costStars: reward.costStars, // price snapshot
      })
      .returning();
    return request;
  });
}

export async function cancelRedemption(
  db: Db,
  session: Session,
  redemptionId: string,
): Promise<void> {
  await assertCan(db, session, "redemption.request", session.userId);
  const updated = await db
    .update(redemptions)
    .set({ status: "canceled", decidedAt: new Date() })
    .where(
      and(
        eq(redemptions.id, redemptionId),
        eq(redemptions.childId, session.userId),
        eq(redemptions.status, "requested"),
      ),
    )
    .returning({ id: redemptions.id });
  if (updated.length === 0) throw new RedemptionError("notRequested");
}

export async function decideRedemption(
  db: Db,
  session: Session,
  redemptionId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const request = await db.query.redemptions.findFirst({
    where: eq(redemptions.id, redemptionId),
  });
  if (!request) throw new RedemptionError("notFound");
  await assertCan(db, session, "redemption.approve", request.childId);
  if (request.status !== "requested") throw new RedemptionError("notRequested");

  const reward = await db.query.rewards.findFirst({
    where: eq(rewards.id, request.rewardId),
    columns: { name: true, emoji: true },
  });
  const child = await db.query.users.findFirst({
    where: eq(users.id, request.childId),
    columns: { familyId: true },
  });
  const family = child
    ? await db.query.families.findFirst({
        where: eq(families.id, child.familyId),
        columns: { timezone: true },
      })
    : null;

  await db.transaction(async (tx) => {
    // Status guard: concurrent guardians settle exactly once.
    const updated = await tx
      .update(redemptions)
      .set({
        status: decision,
        decidedAt: new Date(),
        decidedById: session.userId,
      })
      .where(
        and(
          eq(redemptions.id, redemptionId),
          eq(redemptions.status, "requested"),
        ),
      )
      .returning({ id: redemptions.id });
    if (updated.length === 0) throw new RedemptionError("notRequested");

    if (decision === "approved") {
      // Re-check: adjustments/penalties since the request could have
      // dropped the confirmed balance below the snapshot price.
      const balance = await getBalance(tx, request.childId);
      if (balance.confirmed < request.costStars) {
        throw new RedemptionError("insufficientStars");
      }
      await insertRedeem(tx, {
        childId: request.childId,
        redemptionId: request.id,
        cost: request.costStars,
        note: reward ? `${reward.emoji} ${reward.name}` : "兑换",
        occurredOn: todayIn(family?.timezone ?? "Asia/Shanghai"),
        createdById: session.userId,
      });
    }
  });
}

export type RedemptionWithReward = Redemption & { reward: Reward };

export async function listRedemptionsForChild(
  db: Db,
  childId: string,
  limit = 20,
): Promise<RedemptionWithReward[]> {
  const rows = await db
    .select({ redemption: redemptions, reward: rewards })
    .from(redemptions)
    .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .where(eq(redemptions.childId, childId))
    .orderBy(desc(redemptions.requestedAt))
    .limit(limit);
  return rows.map((row) => ({ ...row.redemption, reward: row.reward }));
}

export type PendingRedemption = RedemptionWithReward & {
  child: { id: string; name: string; avatar: string };
};

export async function pendingRedemptionsForFamily(
  db: Db,
  familyId: string,
): Promise<PendingRedemption[]> {
  const rows = await db
    .select({ redemption: redemptions, reward: rewards, child: users })
    .from(redemptions)
    .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .innerJoin(users, eq(redemptions.childId, users.id))
    .where(
      and(eq(users.familyId, familyId), eq(redemptions.status, "requested")),
    )
    .orderBy(asc(redemptions.requestedAt));
  return rows.map((row) => ({
    ...row.redemption,
    reward: row.reward,
    child: { id: row.child.id, name: row.child.name, avatar: row.child.avatar },
  }));
}
