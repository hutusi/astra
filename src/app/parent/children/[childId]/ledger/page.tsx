import { inArray } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { habits, type TransactionType } from "@/db/schema";
import { requireGuardian } from "@/lib/session";
import { sweepAutoConfirm } from "@/server/services/checkins";
import {
  getBalance,
  listPenaltyRules,
  listTransactions,
} from "@/server/services/ledger";
import { getChild } from "../get-child";
import {
  AddRuleDialog,
  AdjustDialog,
  EditRuleDialog,
  PenaltyDialog,
  ReverseButton,
} from "./ledger-tools";

const TYPE_EMOJI: Record<TransactionType, string> = {
  earn: "⭐",
  bonus: "🎉",
  penalty: "⚠️",
  redeem: "🎁",
  reversal: "↩️",
  adjust: "🛠️",
};

export default async function ChildLedgerPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const session = await requireGuardian();
  const { childId } = await params;
  const child = await getChild(session.familyId, childId);
  if (!child) notFound();
  const t = await getTranslations("ledger");

  await sweepAutoConfirm(db, childId);
  const [balance, transactions, rules] = await Promise.all([
    getBalance(db, childId),
    listTransactions(db, childId, 100),
    listPenaltyRules(db, childId),
  ]);

  const reversedIds = new Set(
    transactions.flatMap((tx) => (tx.reversesId ? [tx.reversesId] : [])),
  );
  const habitIds = [
    ...new Set(transactions.flatMap((tx) => (tx.habitId ? [tx.habitId] : []))),
  ];
  const habitRows = habitIds.length
    ? await db.query.habits.findMany({
        where: inArray(habits.id, habitIds),
        columns: { id: true, name: true, emoji: true },
      })
    : [];
  const habitById = new Map(habitRows.map((h) => [h.id, h]));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("confirmed")}
            </span>
            <span className="text-2xl font-semibold text-amber-600">
              ⭐ {balance.confirmed}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("pendingLabel")}
            </span>
            <span className="text-2xl font-semibold">{balance.pending}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("reservedLabel")}
            </span>
            <span className="text-2xl font-semibold">{balance.reserved}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("availableLabel")}
            </span>
            <span className="text-2xl font-semibold">{balance.available}</span>
          </div>
          <div className="ml-auto flex gap-2">
            <PenaltyDialog childId={childId} rules={rules} />
            <AdjustDialog childId={childId} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("rulesSection")}</CardTitle>
            <AddRuleDialog childId={childId} />
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {rules.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                {t("noRules")}
              </p>
            )}
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 py-2.5">
                <div className="flex flex-1 flex-col">
                  <span
                    className={
                      rule.active
                        ? "text-sm font-medium"
                        : "text-sm text-muted-foreground line-through"
                    }
                  >
                    {rule.title}
                  </span>
                  {rule.description && (
                    <span className="text-xs text-muted-foreground">
                      {rule.description}
                    </span>
                  )}
                </div>
                <Badge variant="outline">≤ {rule.maxStars} ⭐</Badge>
                <EditRuleDialog rule={rule} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("historySection")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {transactions.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">{t("empty")}</p>
            )}
            {transactions.map((tx) => {
              const habit = tx.habitId ? habitById.get(tx.habitId) : null;
              const label = tx.note ?? habit?.name ?? t(`types.${tx.type}`);
              const reversible =
                tx.status === "confirmed" &&
                tx.type !== "reversal" &&
                !reversedIds.has(tx.id);
              return (
                <div
                  key={tx.id}
                  className={`flex items-center gap-3 py-2.5 ${
                    tx.status === "rejected" || reversedIds.has(tx.id)
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  <span className="text-lg">
                    {habit?.emoji ?? TYPE_EMOJI[tx.type]}
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {tx.occurredOn} · {t(`types.${tx.type}`)}
                      {tx.status === "pending" && ` · ${t("pendingLabel")}`}
                      {tx.status === "rejected" && ` · ${t("rejectedLabel")}`}
                      {tx.autoConfirmed && ` · ${t("autoConfirmed")}`}
                      {reversedIds.has(tx.id) && ` · ${t("reversedLabel")}`}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      tx.amount > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                  {reversible && (
                    <ReverseButton transactionId={tx.id} childId={childId} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
