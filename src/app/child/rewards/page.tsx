import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { requireChild } from "@/lib/session";
import { sweepAutoConfirm } from "@/server/services/checkins";
import { getBalance } from "@/server/services/ledger";
import {
  listRedemptionsForChild,
  listRewards,
} from "@/server/services/redemptions";
import { CancelButton, RequestButton } from "./reward-buttons";

export default async function ChildRewardsPage() {
  const session = await requireChild();
  const t = await getTranslations("childRewards");

  await sweepAutoConfirm(db, session.userId);
  const [balance, catalog, mine] = await Promise.all([
    getBalance(db, session.userId),
    listRewards(db, session.familyId, true),
    listRedemptionsForChild(db, session.userId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 lg:max-w-3xl">
      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-xl font-semibold">🎁 {t("title")}</h1>
        <p className="text-sm text-slate-300">
          {t("available", { count: balance.available })}
          {balance.reserved > 0 &&
            ` · ${t("reserved", { count: balance.reserved })}`}
        </p>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {catalog.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">
            {t("emptyCatalog")}
          </p>
        )}
        {catalog.map((reward) => (
          <li
            key={reward.id}
            className="flex items-center gap-3 rounded-2xl bg-white/10 p-4"
          >
            <span className="text-3xl">{reward.emoji}</span>
            <div className="flex flex-1 flex-col">
              <span className="font-medium">{reward.name}</span>
              <span className="text-xs text-amber-300">
                ⭐ {reward.costStars}
              </span>
            </div>
            <RequestButton
              rewardId={reward.id}
              affordable={balance.available >= reward.costStars}
            />
          </li>
        ))}
      </ul>

      {mine.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-slate-300">
            {t("myRequests")}
          </h2>
          <ul className="flex flex-col gap-2">
            {mine.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 rounded-xl bg-white/10 p-3"
              >
                <span className="text-xl">{request.reward.emoji}</span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm">{request.reward.name}</span>
                  <span className="text-xs text-slate-400">
                    ⭐ {request.costStars} · {t(`status.${request.status}`)}
                  </span>
                </div>
                {request.status === "requested" && (
                  <CancelButton redemptionId={request.id} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
