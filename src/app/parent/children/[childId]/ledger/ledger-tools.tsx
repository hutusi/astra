"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PenaltyRule } from "@/db/schema";
import {
  adjustAction,
  createRuleAction,
  penaltyAction,
  reverseAction,
  updateRuleAction,
} from "./actions";

export function PenaltyDialog({
  childId,
  rules,
}: {
  childId: string;
  rules: PenaltyRule[];
}) {
  const t = useTranslations("ledger");
  const activeRules = rules.filter((rule) => rule.active);
  if (activeRules.length === 0) return null;

  return (
    <FormDialog
      trigger={<Button variant="outline">{t("penalty")}</Button>}
      title={t("penalty")}
      action={penaltyAction}
      errorNamespace="ledger"
    >
      <input type="hidden" name="childId" value={childId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="ruleId">{t("rule")}</Label>
        <select
          id="ruleId"
          name="ruleId"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {activeRules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.title}（≤{rule.maxStars}⭐）
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">{t("reason")}</Label>
        <Input id="note" name="note" required maxLength={200} />
        <p className="text-xs text-muted-foreground">{t("penaltyHint")}</p>
      </div>
    </FormDialog>
  );
}

export function AdjustDialog({ childId }: { childId: string }) {
  const t = useTranslations("ledger");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("adjust")}</Button>}
      title={t("adjust")}
      action={adjustAction}
      errorNamespace="ledger"
    >
      <input type="hidden" name="childId" value={childId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">{t("amount")}</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min={-1000}
          max={1000}
          defaultValue={1}
          required
        />
        <p className="text-xs text-muted-foreground">{t("amountHint")}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="note">{t("reason")}</Label>
        <Input id="note" name="note" required maxLength={200} />
      </div>
    </FormDialog>
  );
}

export function ReverseButton({
  transactionId,
  childId,
}: {
  transactionId: string;
  childId: string;
}) {
  const t = useTranslations("ledger");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await reverseAction(transactionId, childId);
          if (result && "error" in result) {
            toast.error(t(`errors.${result.error}` as never));
          }
        })
      }
      className="text-xs text-muted-foreground underline disabled:opacity-50"
    >
      {t("reverse")}
    </button>
  );
}

function RuleFields({ rule }: { rule?: PenaltyRule }) {
  const t = useTranslations("ledger");
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">{t("ruleTitle")}</Label>
        <Input id="title" name="title" defaultValue={rule?.title} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("ruleDescription")}</Label>
        <Input
          id="description"
          name="description"
          defaultValue={rule?.description ?? ""}
        />
        <p className="text-xs text-muted-foreground">
          {t("ruleDescriptionHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="maxStars">{t("maxStars")}</Label>
        <Input
          id="maxStars"
          name="maxStars"
          type="number"
          min={1}
          max={100}
          defaultValue={rule?.maxStars ?? 2}
          required
        />
      </div>
    </>
  );
}

export function AddRuleDialog({ childId }: { childId: string }) {
  const t = useTranslations("ledger");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addRule")}</Button>}
      title={t("addRule")}
      action={createRuleAction}
      errorNamespace="ledger"
    >
      <input type="hidden" name="childId" value={childId} />
      <RuleFields />
    </FormDialog>
  );
}

export function EditRuleDialog({ rule }: { rule: PenaltyRule }) {
  const t = useTranslations("ledger");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={`${tCommon("edit")} · ${rule.title}`}
      action={updateRuleAction}
      errorNamespace="ledger"
    >
      <input type="hidden" name="ruleId" value={rule.id} />
      <RuleFields rule={rule} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          value="on"
          defaultChecked={rule.active}
        />
        {t("ruleActive")}
      </label>
      <input type="hidden" name="active" value="off" />
    </FormDialog>
  );
}
