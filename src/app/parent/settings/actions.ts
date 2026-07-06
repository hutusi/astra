"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { STAGES } from "@/db/schema";
import { AuthzError } from "@/lib/authz";
import { requireGuardian } from "@/lib/session";
import {
  addChild,
  addGuardian,
  FamilyError,
  updateChild,
} from "@/server/services/families";

export type MemberFormState = { ok: true } | { error: string } | null;

const addChildSchema = z.object({
  name: z.string().trim().min(1).max(20),
  avatar: z.string().min(1).max(8),
  pin: z.string().regex(/^\d{4}$/),
  stage: z.enum(STAGES),
  birthdate: z.string().optional(),
});

const updateChildSchema = z.object({
  childId: z.string().min(1),
  name: z.string().trim().min(1).max(20),
  avatar: z.string().min(1).max(8),
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  stage: z.enum(STAGES),
  birthdate: z.string().optional(),
  locale: z.enum(["zh", "en"]),
});

const addGuardianSchema = z.object({
  name: z.string().trim().min(1).max(20),
  avatar: z.string().min(1).max(8),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
});

function errorState(error: unknown): MemberFormState {
  if (error instanceof FamilyError) return { error: error.code };
  if (error instanceof AuthzError) return { error: "invalid" };
  if (error instanceof z.ZodError) return { error: "invalid" };
  throw error;
}

export async function addChildAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const session = await requireGuardian();
  try {
    const input = addChildSchema.parse(Object.fromEntries(formData));
    await addChild(db, session, input);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/settings");
  return { ok: true };
}

export async function updateChildAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const session = await requireGuardian();
  try {
    const { childId, ...input } = updateChildSchema.parse(
      Object.fromEntries(formData),
    );
    await updateChild(db, session, childId, input);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/settings");
  return { ok: true };
}

export async function addGuardianAction(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const session = await requireGuardian();
  try {
    const input = addGuardianSchema.parse(Object.fromEntries(formData));
    await addGuardian(db, session, input);
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/parent/settings");
  return { ok: true };
}
