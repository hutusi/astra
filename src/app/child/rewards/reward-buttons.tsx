"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelRedemptionAction, requestRedemptionAction } from "./actions";

export function RequestButton({
  rewardId,
  affordable,
}: {
  rewardId: string;
  affordable: boolean;
}) {
  const t = useTranslations("childRewards");
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || !affordable}
      onClick={() =>
        startTransition(async () => {
          const result = await requestRedemptionAction(rewardId);
          if ("error" in result) {
            toast.error(t(`errors.${result.error}` as never));
          } else {
            toast.success(t("requested"));
          }
        })
      }
      className="rounded-full bg-amber-400/90 px-4 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-amber-300 active:scale-95 disabled:bg-white/10 disabled:text-slate-500"
    >
      {pending ? "…" : affordable ? t("redeem") : t("notEnough")}
    </button>
  );
}

export function CancelButton({ redemptionId }: { redemptionId: string }) {
  const t = useTranslations("childRewards");
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelRedemptionAction(redemptionId);
          if ("error" in result) {
            toast.error(t(`errors.${result.error}` as never));
          }
        })
      }
      className="text-xs text-slate-400 underline disabled:opacity-50"
    >
      {t("cancel")}
    </button>
  );
}
