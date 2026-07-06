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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAGES, type Stage, type User } from "@/db/schema";
import {
  addChildAction,
  addGuardianAction,
  updateChildAction,
  type MemberFormState,
} from "./actions";

const CHILD_AVATARS = ["🦖", "🐯", "🐼", "🦊", "🐰", "🦄", "🚀", "⚽", "🎨", "🌟"];
const GUARDIAN_AVATARS = ["👨", "👩", "🧑", "👴", "👵"];

function AvatarPicker({
  options,
  defaultValue,
}: {
  options: string[];
  defaultValue?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? options[0]);
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name="avatar" value={selected} />
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

function StageSelect({ defaultValue }: { defaultValue?: Stage }) {
  const t = useTranslations("stages");
  const tSettings = useTranslations("settings");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="stage">{tSettings("stage")}</Label>
      <select
        id="stage"
        name="stage"
        defaultValue={defaultValue ?? "co_authored"}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {t(stage)}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{tSettings("stageHint")}</p>
    </div>
  );
}

function MemberDialog({
  trigger,
  title,
  action,
  children,
}: {
  trigger: React.ReactElement<Record<string, unknown>>;
  title: string;
  action: (
    prev: MemberFormState,
    formData: FormData,
  ) => Promise<MemberFormState>;
  children: React.ReactNode;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (open && state && "ok" in state) {
      toast.success(t("saved"));
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
              {t(`errors.${state.error}` as Parameters<typeof t>[0])}
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

export function AddChildDialog() {
  const t = useTranslations("settings");
  return (
    <MemberDialog
      trigger={<Button variant="outline">{t("addChild")}</Button>}
      title={t("addChild")}
      action={addChildAction}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={20} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("avatar")}</Label>
        <AvatarPicker options={CHILD_AVATARS} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">{t("pin")}</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          required
        />
      </div>
      <StageSelect />
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthdate">{t("birthdate")}</Label>
        <Input id="birthdate" name="birthdate" type="date" />
      </div>
    </MemberDialog>
  );
}

export function EditChildDialog({ child }: { child: User }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  return (
    <MemberDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={`${tCommon("edit")} · ${child.name}`}
      action={updateChildAction}
    >
      <input type="hidden" name="childId" value={child.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          name="name"
          defaultValue={child.name}
          required
          maxLength={20}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("avatar")}</Label>
        <AvatarPicker options={CHILD_AVATARS} defaultValue={child.avatar} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">{t("pin")}</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder={t("pinKeepEmpty")}
        />
      </div>
      <StageSelect defaultValue={child.stage ?? undefined} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthdate">{t("birthdate")}</Label>
        <Input
          id="birthdate"
          name="birthdate"
          type="date"
          defaultValue={child.birthdate ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="locale">{t("locale")}</Label>
        <select
          id="locale"
          name="locale"
          defaultValue={child.locale}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </div>
    </MemberDialog>
  );
}

export function AddGuardianDialog() {
  const t = useTranslations("settings");
  return (
    <MemberDialog
      trigger={<Button variant="outline">{t("addGuardian")}</Button>}
      title={t("addGuardian")}
      action={addGuardianAction}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={20} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("avatar")}</Label>
        <AvatarPicker options={GUARDIAN_AVATARS} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
        />
      </div>
    </MemberDialog>
  );
}
