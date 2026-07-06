"use client";

import { useTranslations } from "next-intl";
import { EmojiPicker, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STAGES, type Stage, type User } from "@/db/schema";
import {
  addChildAction,
  addGuardianAction,
  updateChildAction,
} from "./actions";

const CHILD_AVATARS = ["🦖", "🐯", "🐼", "🦊", "🐰", "🦄", "🚀", "⚽", "🎨", "🌟"];
const GUARDIAN_AVATARS = ["👨", "👩", "🧑", "👴", "👵"];

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

export function AddChildDialog() {
  const t = useTranslations("settings");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addChild")}</Button>}
      title={t("addChild")}
      action={addChildAction}
      errorNamespace="settings"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={20} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("avatar")}</Label>
        <EmojiPicker name="avatar" options={CHILD_AVATARS} />
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
    </FormDialog>
  );
}

export function EditChildDialog({ child }: { child: User }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={`${tCommon("edit")} · ${child.name}`}
      action={updateChildAction}
      errorNamespace="settings"
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
        <EmojiPicker
          name="avatar"
          options={CHILD_AVATARS}
          defaultValue={child.avatar}
        />
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
    </FormDialog>
  );
}

export function AddGuardianDialog() {
  const t = useTranslations("settings");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addGuardian")}</Button>}
      title={t("addGuardian")}
      action={addGuardianAction}
      errorNamespace="settings"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required maxLength={20} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("avatar")}</Label>
        <EmojiPicker name="avatar" options={GUARDIAN_AVATARS} />
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
    </FormDialog>
  );
}
