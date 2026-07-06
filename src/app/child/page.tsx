import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { families, users } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import { requireChild } from "@/lib/session";
import { habitsForDate } from "@/server/services/habits";

export default async function ChildToday() {
  const session = await requireChild();
  const t = await getTranslations("childHome");

  const [me, family] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db.query.families.findFirst({
      where: eq(families.id, session.familyId),
    }),
  ]);
  const today = todayIn(family?.timezone ?? "Asia/Shanghai");
  const habits = await habitsForDate(db, session.userId, today);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <span className="text-4xl">{me?.avatar}</span>
        <h1 className="text-xl font-semibold">
          {t("greeting", { name: session.name })}
        </h1>
        <p className="text-xs text-slate-400">{today}</p>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-5xl">🌌</div>
          <p className="text-slate-300">{t("noHabitsToday")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {habits.map((habit) => (
            <li
              key={habit.id}
              className="flex items-center gap-3 rounded-2xl bg-white/10 p-4"
            >
              <span className="text-3xl">{habit.emoji}</span>
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{habit.name}</span>
                {habit.rewardMode === "stars" && (
                  <span className="text-xs text-amber-300">
                    ⭐ ×{habit.starsPerCompletion}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {t("checkInComingSoon")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
