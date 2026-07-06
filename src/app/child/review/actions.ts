"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { NoteFormState } from "@/components/review/note-form";
import { db } from "@/db";
import { AuthzError } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { saveReviewNote } from "@/server/services/reviews";

const noteSchema = z.object({
  childId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500),
});

export async function saveChildNoteAction(
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const session = await getSession();
  if (!session) return { error: "invalid" };
  try {
    const input = noteSchema.parse(Object.fromEntries(formData));
    await saveReviewNote(db, session, input);
    revalidatePath("/child/review");
  } catch (error) {
    if (error instanceof AuthzError || error instanceof z.ZodError) {
      return { error: "invalid" };
    }
    throw error;
  }
  return { ok: true };
}
