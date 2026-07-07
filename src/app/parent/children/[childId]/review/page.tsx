import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewNoteForm } from "@/components/review/note-form";
import { WeekStatsCard } from "@/components/review/week-stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { families } from "@/db/schema";
import { addDays, mondayOf, todayIn } from "@/lib/dates";
import { requireGuardian } from "@/lib/session";
import { getReview, getWeekStats } from "@/server/services/reviews";
import { getChild } from "../get-child";
import { saveParentNoteAction } from "./actions";

export default async function ParentReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ childId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireGuardian();
  const { childId } = await params;
  const { week } = await searchParams;
  const child = await getChild(session.familyId, childId);
  if (!child) notFound();
  const t = await getTranslations("review");

  const family = await db.query.families.findFirst({
    where: eq(families.id, session.familyId),
  });
  const today = todayIn(family?.timezone ?? "Asia/Shanghai");
  const weekStart = mondayOf(
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today,
  );

  const [stats, review] = await Promise.all([
    getWeekStats(db, childId, weekStart, today),
    getReview(db, childId, weekStart),
  ]);

  const base = `/parent/children/${childId}/review`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`${base}?week=${addDays(weekStart, -7)}`}
            className="rounded-md border px-2 py-1 hover:bg-muted"
          >
            ←
          </Link>
          <span className="text-muted-foreground">
            {weekStart} ~ {addDays(weekStart, 6)}
          </span>
          {weekStart < mondayOf(today) && (
            <Link
              href={`${base}?week=${addDays(weekStart, 7)}`}
              className="rounded-md border px-2 py-1 hover:bg-muted"
            >
              →
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {stats ? (
          <WeekStatsCard stats={stats} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("noPlan")}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("notesSection")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {review?.childNote && (
              <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
                <span className="text-xs text-muted-foreground">
                  {t("childNoteLabel", { name: child.name })}
                </span>
                <p className="text-sm">{review.childNote}</p>
              </div>
            )}
            <ReviewNoteForm
              action={saveParentNoteAction}
              childId={childId}
              weekStart={weekStart}
              defaultValue={review?.parentNote ?? ""}
              label={t("parentNoteLabel")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
