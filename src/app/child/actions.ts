"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { checkIn, CheckInError } from "@/server/services/checkins";

export type CheckInState = { ok: true } | { error: string };

export async function checkInAction(habitId: string): Promise<CheckInState> {
  const session = await getSession();
  if (!session) return { error: "invalid" };

  try {
    await checkIn(db, session, { habitId });
  } catch (error) {
    if (error instanceof CheckInError) return { error: error.code };
    if (error instanceof AuthzError) return { error: "invalid" };
    throw error;
  }
  revalidatePath("/child");
  revalidatePath("/child/stars");
  return { ok: true };
}
