"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { requireGuardian } from "@/lib/session";
import {
  CheckInError,
  decideCheckIn,
  pendingForFamily,
} from "@/server/services/checkins";

export async function decideCheckInAction(
  checkInId: string,
  decision: "confirmed" | "rejected",
): Promise<void> {
  const session = await requireGuardian();
  try {
    await decideCheckIn(db, session, checkInId, decision);
  } catch (error) {
    // Another guardian settled it first — the queue will refresh anyway.
    if (error instanceof CheckInError || error instanceof AuthzError) {
      revalidatePath("/parent");
      return;
    }
    throw error;
  }
  revalidatePath("/parent");
}

export async function confirmAllPendingAction(): Promise<void> {
  const session = await requireGuardian();
  const pending = await pendingForFamily(db, session.familyId);
  for (const item of pending) {
    try {
      await decideCheckIn(db, session, item.checkIn.id, "confirmed");
    } catch (error) {
      if (error instanceof CheckInError || error instanceof AuthzError) {
        continue; // settled concurrently — fine
      }
      throw error;
    }
  }
  revalidatePath("/parent");
}
