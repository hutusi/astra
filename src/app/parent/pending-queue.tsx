"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingCheckIn } from "@/server/services/checkins";
import { confirmAllPendingAction, decideCheckInAction } from "./actions";

function DecideButtons({ checkInId }: { checkInId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => decideCheckInAction(checkInId, "confirmed"))
        }
        className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/30 disabled:opacity-50"
        aria-label="confirm"
      >
        ✓
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => decideCheckInAction(checkInId, "rejected"))
        }
        className="flex size-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 transition hover:bg-rose-500/30 disabled:opacity-50"
        aria-label="reject"
      >
        ✗
      </button>
    </div>
  );
}

function ConfirmAllButton() {
  const t = useTranslations("parentDashboard");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => confirmAllPendingAction())}
    >
      {pending ? "…" : t("confirmAll")}
    </Button>
  );
}

export function PendingQueue({ items }: { items: PendingCheckIn[] }) {
  const t = useTranslations("parentDashboard");

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {t("pendingSection")} ({items.length})
        </CardTitle>
        <ConfirmAllButton />
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {items.map(({ checkIn, habit, child }) => (
          <div key={checkIn.id} className="flex items-center gap-3 py-2.5">
            <span className="text-xl">{child.avatar}</span>
            <span className="text-xl">{habit.emoji}</span>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">{habit.name}</span>
              <span className="text-xs text-muted-foreground">
                {child.name} · {checkIn.date}
              </span>
            </div>
            {habit.rewardMode === "stars" && (
              <span className="text-sm text-amber-600">
                ⭐ {habit.starsPerCompletion}
              </span>
            )}
            <DecideButtons checkInId={checkIn.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
