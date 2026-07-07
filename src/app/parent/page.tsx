import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { requireGuardian } from "@/lib/session";
import {
  pendingForFamily,
  sweepAutoConfirm,
} from "@/server/services/checkins";
import { getBalance, type Balance } from "@/server/services/ledger";
import { PendingQueue } from "./pending-queue";

function ChildCard({
  child,
  balance,
  pendingLabel,
}: {
  child: User;
  balance: Balance;
  pendingLabel: string;
}) {
  return (
    <Link href={`/parent/children/${child.id}`}>
      <Card className="transition hover:bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{child.avatar}</span>
            {child.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-amber-600">
            ⭐ {balance.confirmed}
          </span>
          {balance.pending > 0 && (
            <span className="text-muted-foreground">{pendingLabel}</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function ParentDashboard() {
  const session = await requireGuardian();
  const t = await getTranslations("parentDashboard");

  const children = await db.query.users.findMany({
    where: and(eq(users.familyId, session.familyId), eq(users.role, "child")),
  });

  await Promise.all(children.map((c) => sweepAutoConfirm(db, c.id)));

  const [pending, balances] = await Promise.all([
    pendingForFamily(db, session.familyId),
    Promise.all(children.map((c) => getBalance(db, c.id))),
  ]);

  const cards = children.map((child, i) => (
    <ChildCard
      key={child.id}
      child={child}
      balance={balances[i]}
      pendingLabel={t("pendingCount", { count: balances[i].pending })}
    />
  ));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {pending.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <div className="lg:col-span-2">
            <PendingQueue items={pending} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {cards}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      )}
    </div>
  );
}
