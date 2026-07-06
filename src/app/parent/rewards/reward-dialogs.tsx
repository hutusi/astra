"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { EmojiPicker, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Reward } from "@/db/schema";
import type { PendingRedemption } from "@/server/services/redemptions";
import {
  createRewardAction,
  decideRedemptionAction,
  updateRewardAction,
} from "./actions";

const REWARD_EMOJI = ["🍦", "🎮", "🎬", "📚", "🎡", "🧸", "⚽", "🍕", "🎁", "💰"];

function RewardFields({ reward }: { reward?: Reward }) {
  const t = useTranslations("parentRewards");
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" defaultValue={reward?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("emoji")}</Label>
        <EmojiPicker
          name="emoji"
          options={REWARD_EMOJI}
          defaultValue={reward?.emoji}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="costStars">{t("cost")}</Label>
        <Input
          id="costStars"
          name="costStars"
          type="number"
          min={1}
          defaultValue={reward?.costStars ?? 10}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Input
          id="description"
          name="description"
          defaultValue={reward?.description ?? ""}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          value="on"
          defaultChecked={reward?.active ?? true}
        />
        {t("activeLabel")}
      </label>
      {/* unchecked checkboxes submit nothing; provide the off fallback */}
      <input type="hidden" name="active" value="off" />
    </>
  );
}

export function AddRewardDialog() {
  const t = useTranslations("parentRewards");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addReward")}</Button>}
      title={t("addReward")}
      action={createRewardAction}
      errorNamespace="parentRewards"
    >
      <RewardFields />
    </FormDialog>
  );
}

export function EditRewardDialog({ reward }: { reward: Reward }) {
  const t = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {t("edit")}
        </Button>
      }
      title={`${t("edit")} · ${reward.name}`}
      action={updateRewardAction}
      errorNamespace="parentRewards"
    >
      <input type="hidden" name="rewardId" value={reward.id} />
      <RewardFields reward={reward} />
    </FormDialog>
  );
}

export function RedemptionDecideButtons({
  redemptionId,
}: {
  redemptionId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            decideRedemptionAction(redemptionId, "approved"),
          )
        }
        className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/30 disabled:opacity-50"
        aria-label="approve"
      >
        ✓
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            decideRedemptionAction(redemptionId, "rejected"),
          )
        }
        className="flex size-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 transition hover:bg-rose-500/30 disabled:opacity-50"
        aria-label="reject"
      >
        ✗
      </button>
    </div>
  );
}

export function RedemptionQueueList({
  items,
}: {
  items: PendingRedemption[];
}) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 py-2.5">
          <span className="text-xl">{item.child.avatar}</span>
          <span className="text-xl">{item.reward.emoji}</span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">{item.reward.name}</span>
            <span className="text-xs text-muted-foreground">
              {item.child.name}
            </span>
          </div>
          <span className="text-sm text-amber-600">⭐ {item.costStars}</span>
          <RedemptionDecideButtons redemptionId={item.id} />
        </div>
      ))}
    </>
  );
}
