"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireGuardian } from "@/lib/session";
import {
  CheckInError,
  decideCheckIn,
  pendingForFamily,
} from "@/server/services/checkins";

function revalidateAfterDecision() {
  revalidatePath("/parent");
  revalidatePath("/child");
  revalidatePath("/child/stars");
}

export async function decideCheckInAction(
  checkInId: string,
  decision: "confirmed" | "rejected",
): Promise<void> {
  const session = await requireGuardian();
  try {
    await decideCheckIn(db, session, checkInId, decision);
  } catch (error) {
    // Another guardian settled it first (or it auto-confirmed) — the queue
    // will refresh. Anything else (incl. AuthzError) is a real failure.
    if (error instanceof CheckInError) {
      revalidatePath("/parent");
      return;
    }
    throw error;
  }
  revalidateAfterDecision();
}

export async function confirmAllPendingAction(): Promise<void> {
  const session = await requireGuardian();
  const pending = await pendingForFamily(db, session.familyId);
  for (const item of pending) {
    try {
      await decideCheckIn(db, session, item.checkIn.id, "confirmed");
    } catch (error) {
      if (error instanceof CheckInError) continue; // settled concurrently
      throw error;
    }
  }
  revalidateAfterDecision();
}
