"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { requireGuardian } from "@/lib/session";
import {
  createReward,
  decideRedemption,
  RedemptionError,
  updateReward,
} from "@/server/services/redemptions";

export type RewardFormState = { ok: true } | { error: string } | null;

const rewardSchema = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(8),
  description: z.string().max(200).optional(),
  costStars: z.coerce.number().int().min(1).max(10000),
  // Checkbox: present ("on") when checked, absent when not.
  active: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});

function errorState(error: unknown): RewardFormState {
  if (error instanceof RedemptionError) return { error: error.code };
  if (error instanceof AuthzError || error instanceof z.ZodError) {
    return { error: "invalid" };
  }
  throw error;
}

export async function createRewardAction(
  _prev: RewardFormState,
  formData: FormData,
): Promise<RewardFormState> {
  const session = await requireGuardian();
  try {
    await createReward(db, session, rewardSchema.parse(Object.fromEntries(formData)));
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/rewards");
  revalidatePath("/child/rewards");
  return { ok: true };
}

export async function updateRewardAction(
  _prev: RewardFormState,
  formData: FormData,
): Promise<RewardFormState> {
  const session = await requireGuardian();
  try {
    const rewardId = z.string().min(1).parse(formData.get("rewardId"));
    await updateReward(
      db,
      session,
      rewardId,
      rewardSchema.parse(Object.fromEntries(formData)),
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/rewards");
  revalidatePath("/child/rewards");
  return { ok: true };
}

export async function decideRedemptionAction(
  redemptionId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const session = await requireGuardian();
  try {
    await decideRedemption(db, session, redemptionId, decision);
  } catch (error) {
    if (error instanceof RedemptionError || error instanceof AuthzError) {
      revalidatePath("/parent/rewards");
      return;
    }
    throw error;
  }
  revalidatePath("/parent/rewards");
  revalidatePath("/parent");
}
