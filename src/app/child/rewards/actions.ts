"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { getSession } from "@/lib/session";
import {
  cancelRedemption,
  RedemptionError,
  requestRedemption,
} from "@/server/services/redemptions";

export type RedeemState = { ok: true } | { error: string };

export async function requestRedemptionAction(
  rewardId: string,
): Promise<RedeemState> {
  const session = await getSession();
  if (!session) return { error: "invalid" };
  try {
    await requestRedemption(db, session, rewardId);
  } catch (error) {
    if (error instanceof RedemptionError) return { error: error.code };
    if (error instanceof AuthzError) return { error: "invalid" };
    throw error;
  }
  revalidatePath("/child/rewards");
  return { ok: true };
}

export async function cancelRedemptionAction(
  redemptionId: string,
): Promise<RedeemState> {
  const session = await getSession();
  if (!session) return { error: "invalid" };
  try {
    await cancelRedemption(db, session, redemptionId);
  } catch (error) {
    if (error instanceof RedemptionError) return { error: error.code };
    if (error instanceof AuthzError) return { error: "invalid" };
    throw error;
  }
  revalidatePath("/child/rewards");
  return { ok: true };
}
