import { inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { habits, type TransactionType } from "@/db/schema";
import { requireChild } from "@/lib/session";
import { sweepAutoConfirm } from "@/server/services/checkins";
import { getBalance, listTransactions } from "@/server/services/ledger";

const TYPE_EMOJI: Record<TransactionType, string> = {
  earn: "⭐",
  bonus: "🎉",
  penalty: "⚠️",
  redeem: "🎁",
  reversal: "↩️",
  adjust: "🛠️",
};

export default async function ChildStarsPage() {
  const session = await requireChild();
  const t = await getTranslations("childStars");

  await sweepAutoConfirm(db, session.userId);
  const [balance, transactions] = await Promise.all([
    getBalance(db, session.userId),
    listTransactions(db, session.userId, 30),
  ]);

  const habitIds = [
    ...new Set(
      transactions.flatMap((tx) => (tx.habitId ? [tx.habitId] : [])),
    ),
  ];
  const habitRows = habitIds.length
    ? await db.query.habits.findMany({
        where: inArray(habits.id, habitIds),
        columns: { id: true, name: true, emoji: true },
      })
    : [];
  const habitById = new Map(habitRows.map((h) => [h.id, h]));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-2 pt-6 text-center">
        <p className="text-sm text-slate-300">{t("balance")}</p>
        <p className="text-6xl font-bold text-amber-300">
          ⭐ {balance.confirmed}
        </p>
        {balance.pending > 0 && (
          <p className="text-sm text-amber-200/80">
            {t("pending", { count: balance.pending })}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-slate-300">{t("history")}</h2>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {t("empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((tx) => {
              const habit = tx.habitId ? habitById.get(tx.habitId) : null;
              const label = tx.note ?? habit?.name ?? t(`types.${tx.type}`);
              return (
                <li
                  key={tx.id}
                  className={`flex items-center gap-3 rounded-xl bg-white/10 p-3 ${
                    tx.status === "rejected" ? "opacity-40" : ""
                  }`}
                >
                  <span className="text-xl">
                    {habit?.emoji ?? TYPE_EMOJI[tx.type]}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-slate-400">
                      {tx.occurredOn}
                      {tx.status === "pending" && ` · ${t("pendingBadge")}`}
                      {tx.status === "rejected" && ` · ${t("rejectedBadge")}`}
                      {tx.autoConfirmed && ` · ${t("autoConfirmed")}`}
                    </span>
                  </div>
                  <span
                    className={`font-semibold ${
                      tx.amount > 0 ? "text-emerald-300" : "text-rose-300"
                    } ${tx.status !== "confirmed" ? "opacity-60" : ""}`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
