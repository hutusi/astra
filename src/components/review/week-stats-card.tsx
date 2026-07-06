import { getTranslations } from "next-intl/server";
import type { WeekStats } from "@/server/services/reviews";

/** Presentational weekly stats — used by both parent and child review
 * pages; styling stays neutral so it reads fine on light and dark shells. */
export async function WeekStatsCard({
  stats,
  dark = false,
}: {
  stats: WeekStats;
  dark?: boolean;
}) {
  const t = await getTranslations("review");
  const rowBg = dark ? "bg-white/10" : "bg-muted/50";
  const subtle = dark ? "text-slate-400" : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={`flex flex-col rounded-xl p-3 ${rowBg}`}>
          <span className={`text-xs ${subtle}`}>{t("starsIn")}</span>
          <span className="text-xl font-semibold text-emerald-500">
            +{stats.starsIn}
          </span>
        </div>
        <div className={`flex flex-col rounded-xl p-3 ${rowBg}`}>
          <span className={`text-xs ${subtle}`}>{t("starsOut")}</span>
          <span className="text-xl font-semibold text-rose-500">
            −{stats.starsOut}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {stats.habits.map(({ habit, done, scheduled, streak }) => {
          const full = done >= scheduled;
          return (
            <li
              key={habit.id}
              className={`flex items-center gap-3 rounded-xl p-3 ${rowBg}`}
            >
              <span className="text-2xl">{habit.emoji}</span>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{habit.name}</span>
                <span className={`text-xs ${subtle}`}>
                  {t("weekCount", { done, scheduled })}
                  {streak > 1 && ` · 🔥 ${t("streak", { count: streak })}`}
                </span>
              </div>
              <span className="text-lg">{full ? "🌟" : done > 0 ? "✨" : "☁️"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
