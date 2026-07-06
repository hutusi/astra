"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type FormState = { ok: true } | { error: string } | null;

/**
 * Dialog wrapping a server-action form: closes and toasts on success,
 * renders the translated error inline on failure. `errorNamespace` is the
 * message namespace holding `errors.<code>` entries.
 */
export function FormDialog({
  trigger,
  title,
  action,
  errorNamespace,
  children,
}: {
  trigger: React.ReactElement<Record<string, unknown>>;
  title: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  errorNamespace: string;
  children: React.ReactNode;
}) {
  const t = useTranslations(errorNamespace);
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (open && state && "ok" in state) {
      toast.success(tCommon("save"));
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          {children}
          {state && "error" in state && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${state.error}` as never)}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {tCommon("save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmojiPicker({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? options[0]);
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={selected} />
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => setSelected(emoji)}
          className={`flex size-10 items-center justify-center rounded-lg text-xl transition ${
            selected === emoji
              ? "bg-primary/15 ring-2 ring-primary"
              : "bg-muted hover:bg-muted/70"
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
