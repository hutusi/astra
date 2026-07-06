"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";

export type NoteFormState = { ok: true } | { error: string } | null;

export function ReviewNoteForm({
  action,
  childId,
  weekStart,
  defaultValue,
  label,
  dark = false,
}: {
  action: (prev: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  childId: string;
  weekStart: string;
  defaultValue: string;
  label: string;
  dark?: boolean;
}) {
  const t = useTranslations("review");
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <label className={dark ? "text-sm text-slate-300" : "text-sm font-medium"}>
        {label}
      </label>
      <textarea
        name="note"
        rows={3}
        maxLength={500}
        defaultValue={defaultValue}
        placeholder={t("notePlaceholder")}
        className={`rounded-md border p-2 text-sm ${
          dark
            ? "border-white/20 bg-white/10 text-white placeholder:text-slate-500"
            : "border-input bg-transparent"
        }`}
      />
      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">
          {t("saveError")}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending} className="self-end">
        {state && "ok" in state && !pending ? t("saved") : t("saveNote")}
      </Button>
    </form>
  );
}
