"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { checkInAction } from "./actions";

export type CheckInDisplayState = "unchecked" | "pending" | "confirmed";

export function CheckInButton({
  habitId,
  state,
}: {
  habitId: string;
  state: CheckInDisplayState;
}) {
  const t = useTranslations("checkin");
  const [pending, startTransition] = useTransition();

  if (state === "confirmed") {
    return (
      <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">
        ✅
      </span>
    );
  }
  if (state === "pending") {
    return (
      <span
        title={t("pendingBadge")}
        className="flex size-12 flex-col items-center justify-center rounded-full bg-amber-500/20 text-xl"
      >
        ⏳
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await checkInAction(habitId);
          if ("error" in result) {
            toast.error(t(`errors.${result.error}` as never));
          }
        })
      }
      className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-white/40 text-xl transition hover:border-white hover:bg-white/10 active:scale-90 disabled:opacity-50"
      aria-label={t("checkInNow")}
    >
      {pending ? "…" : "☆"}
    </button>
  );
}
