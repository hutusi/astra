import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ReviewNoteForm } from "@/components/review/note-form";
import { WeekStatsCard } from "@/components/review/week-stats-card";
import { db } from "@/db";
import { families } from "@/db/schema";
import { mondayOf, todayIn, addDays } from "@/lib/dates";
import { requireChild } from "@/lib/session";
import { getReview, getWeekStats } from "@/server/services/reviews";
import { saveChildNoteAction } from "./actions";

export default async function ChildReviewPage() {
  const session = await requireChild();
  const t = await getTranslations("review");

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
  });
  const today = todayIn(family?.timezone ?? "Asia/Shanghai");
  const weekStart = mondayOf(today);

  const [stats, review] = await Promise.all([
    getWeekStats(db, session.userId, weekStart, today),
    getReview(db, session.userId, weekStart),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col items-center gap-1 pt-4 text-center">
        <h1 className="text-xl font-semibold">📒 {t("title")}</h1>
        <p className="text-xs text-slate-400">
          {weekStart} ~ {addDays(weekStart, 6)}
        </p>
      </div>

      {stats ? (
        <WeekStatsCard stats={stats} dark />
      ) : (
        <p className="py-8 text-center text-sm text-slate-400">{t("noPlan")}</p>
      )}

      {review?.parentNote && (
        <div className="flex flex-col gap-1 rounded-xl bg-white/10 p-3">
          <span className="text-xs text-slate-400">
            {t("fromParents")}
          </span>
          <p className="text-sm">{review.parentNote}</p>
        </div>
      )}

      <ReviewNoteForm
        action={saveChildNoteAction}
        childId={session.userId}
        weekStart={weekStart}
        defaultValue={review?.childNote ?? ""}
        label={t("childOwnNoteLabel")}
        dark
      />
    </div>
  );
}
