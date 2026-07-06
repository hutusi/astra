"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { requireGuardian } from "@/lib/session";
import {
  createPenaltyRule,
  LedgerError,
  recordAdjust,
  recordPenalty,
  reverseTransaction,
  updatePenaltyRule,
} from "@/server/services/ledger";

export type LedgerFormState = { ok: true } | { error: string } | null;

function errorState(error: unknown): LedgerFormState {
  if (error instanceof LedgerError) return { error: error.code };
  if (error instanceof AuthzError || error instanceof z.ZodError) {
    return { error: "invalid" };
  }
  throw error;
}

function revalidateLedger(childId: string) {
  revalidatePath(`/parent/children/${childId}/ledger`);
  revalidatePath("/parent");
  revalidatePath("/child/stars");
}

const penaltySchema = z.object({
  childId: z.string().min(1),
  ruleId: z.string().min(1),
  note: z.string().trim().min(1).max(200),
});

export async function penaltyAction(
  _prev: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const session = await requireGuardian();
  let childId = "";
  try {
    const input = penaltySchema.parse(Object.fromEntries(formData));
    childId = input.childId;
    await recordPenalty(db, session, input);
  } catch (error) {
    return errorState(error);
  }
  revalidateLedger(childId);
  return { ok: true };
}

const adjustSchema = z.object({
  childId: z.string().min(1),
  amount: z.coerce.number().int().min(-1000).max(1000),
  note: z.string().trim().min(1).max(200),
});

export async function adjustAction(
  _prev: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const session = await requireGuardian();
  let childId = "";
  try {
    const input = adjustSchema.parse(Object.fromEntries(formData));
    childId = input.childId;
    await recordAdjust(db, session, input);
  } catch (error) {
    return errorState(error);
  }
  revalidateLedger(childId);
  return { ok: true };
}

export async function reverseAction(
  transactionId: string,
  childId: string,
): Promise<LedgerFormState> {
  const session = await requireGuardian();
  try {
    await reverseTransaction(db, session, transactionId);
  } catch (error) {
    return errorState(error);
  }
  revalidateLedger(childId);
  return { ok: true };
}

const ruleSchema = z.object({
  childId: z.string().min(1),
  title: z.string().trim().min(1).max(40),
  description: z.string().max(200).optional(),
  maxStars: z.coerce.number().int().min(1).max(100),
});

export async function createRuleAction(
  _prev: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const session = await requireGuardian();
  let childId = "";
  try {
    const input = ruleSchema.parse(Object.fromEntries(formData));
    childId = input.childId;
    await createPenaltyRule(db, session, input);
  } catch (error) {
    return errorState(error);
  }
  revalidateLedger(childId);
  return { ok: true };
}

const updateRuleSchema = ruleSchema.omit({ childId: true }).extend({
  ruleId: z.string().min(1),
  active: z
    .string()
    .optional()
    .transform((value) => value !== "off"),
});

export async function updateRuleAction(
  _prev: LedgerFormState,
  formData: FormData,
): Promise<LedgerFormState> {
  const session = await requireGuardian();
  try {
    const { ruleId, ...input } = updateRuleSchema.parse(
      Object.fromEntries(formData),
    );
    await updatePenaltyRule(db, session, ruleId, input);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/children", "layout");
  return { ok: true };
}
