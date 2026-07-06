"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmojiPicker, FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REWARD_MODES,
  SCHEDULE_TYPES,
  type Goal,
  type Habit,
  type Plan,
  type RewardMode,
  type ScheduleType,
} from "@/db/schema";
import {
  createGoalAction,
  createHabitAction,
  createPlanAction,
  updateGoalAction,
  updateHabitAction,
  updatePlanAction,
} from "./actions";

const HABIT_EMOJI = ["📖", "🏃", "🧹", "🎹", "💤", "🦷", "✍️", "🧮", "🎨", "⚽", "🥦", "🌅"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function CreatePlanDialog({
  childId,
  defaults,
}: {
  childId: string;
  defaults: { name: string; periodStart: string; periodEnd: string };
}) {
  const t = useTranslations("plan");
  return (
    <FormDialog
      trigger={<Button>{t("createPlan")}</Button>}
      title={t("createPlan")}
      action={createPlanAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="childId" value={childId} />
      <PlanFields defaults={defaults} />
    </FormDialog>
  );
}

export function EditPlanDialog({ plan }: { plan: Plan }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={t("editPlan")}
      action={updatePlanAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="planId" value={plan.id} />
      <PlanFields
        defaults={{
          name: plan.name,
          periodStart: plan.periodStart,
          periodEnd: plan.periodEnd,
          notes: plan.notes ?? "",
        }}
      />
    </FormDialog>
  );
}

function PlanFields({
  defaults,
}: {
  defaults: {
    name: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  };
}) {
  const t = useTranslations("plan");
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("planName")}</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodStart">{t("periodStart")}</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={defaults.periodStart}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="periodEnd">{t("periodEnd")}</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={defaults.periodEnd}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{t("notes")}</Label>
        <Input id="notes" name="notes" defaultValue={defaults.notes ?? ""} />
      </div>
    </>
  );
}

function HabitFields({ habit }: { habit?: Habit }) {
  const t = useTranslations("plan");
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    habit?.scheduleType ?? "daily",
  );
  const [rewardMode, setRewardMode] = useState<RewardMode>(
    habit?.rewardMode ?? "stars",
  );
  const defaultDays: number[] = habit?.scheduleDays
    ? JSON.parse(habit.scheduleDays)
    : [];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("habitName")}</Label>
        <Input id="name" name="name" defaultValue={habit?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("emoji")}</Label>
        <EmojiPicker
          name="emoji"
          options={HABIT_EMOJI}
          defaultValue={habit?.emoji}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="scheduleType">{t("schedule")}</Label>
        <select
          id="scheduleType"
          name="scheduleType"
          value={scheduleType}
          onChange={(e) => setScheduleType(e.target.value as ScheduleType)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {SCHEDULE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`scheduleTypes.${type}`)}
            </option>
          ))}
        </select>
      </div>
      {scheduleType === "weekly_days" && (
        <div className="flex gap-1.5">
          {WEEKDAYS.map((day) => (
            <label
              key={day}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-xs has-checked:border-primary has-checked:bg-primary/10"
            >
              <input
                type="checkbox"
                name={`day-${day}`}
                defaultChecked={defaultDays.includes(day)}
                className="sr-only"
              />
              {t(`weekdays.${day}`)}
            </label>
          ))}
        </div>
      )}
      {scheduleType === "x_per_week" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="timesPerWeek">{t("timesPerWeek")}</Label>
          <Input
            id="timesPerWeek"
            name="timesPerWeek"
            type="number"
            min={1}
            max={7}
            defaultValue={habit?.timesPerWeek ?? 3}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="rewardMode">{t("rewardMode")}</Label>
        <select
          id="rewardMode"
          name="rewardMode"
          value={rewardMode}
          onChange={(e) => setRewardMode(e.target.value as RewardMode)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          {REWARD_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(`rewardModes.${mode}`)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{t("rewardModeHint")}</p>
      </div>
      {rewardMode === "stars" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="starsPerCompletion">{t("starsPerCompletion")}</Label>
          <Input
            id="starsPerCompletion"
            name="starsPerCompletion"
            type="number"
            min={1}
            max={20}
            defaultValue={habit?.starsPerCompletion || 1}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("notes")}</Label>
        <Input
          id="description"
          name="description"
          defaultValue={habit?.description ?? ""}
        />
      </div>
    </>
  );
}

export function AddHabitDialog({ planId }: { planId: string }) {
  const t = useTranslations("plan");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addHabit")}</Button>}
      title={t("addHabit")}
      action={createHabitAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="planId" value={planId} />
      <HabitFields />
    </FormDialog>
  );
}

export function EditHabitDialog({ habit }: { habit: Habit }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={`${tCommon("edit")} · ${habit.name}`}
      action={updateHabitAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="habitId" value={habit.id} />
      <HabitFields habit={habit} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="status">{t("habitStatus")}</Label>
        <select
          id="status"
          name="status"
          defaultValue={habit.status}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="active">{t("habitStatuses.active")}</option>
          <option value="paused">{t("habitStatuses.paused")}</option>
          <option value="archived">{t("habitStatuses.archived")}</option>
        </select>
      </div>
    </FormDialog>
  );
}

function GoalFields({ goal }: { goal?: Goal }) {
  const t = useTranslations("plan");
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t("goalName")}</Label>
        <Input id="name" name="name" defaultValue={goal?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bonusStars">{t("bonusStars")}</Label>
        <Input
          id="bonusStars"
          name="bonusStars"
          type="number"
          min={0}
          max={500}
          defaultValue={goal?.bonusStars ?? 20}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="targetDate">{t("targetDate")}</Label>
        <Input
          id="targetDate"
          name="targetDate"
          type="date"
          defaultValue={goal?.targetDate ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">{t("notes")}</Label>
        <Input
          id="description"
          name="description"
          defaultValue={goal?.description ?? ""}
        />
      </div>
    </>
  );
}

export function AddGoalDialog({ planId }: { planId: string }) {
  const t = useTranslations("plan");
  return (
    <FormDialog
      trigger={<Button variant="outline">{t("addGoal")}</Button>}
      title={t("addGoal")}
      action={createGoalAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="planId" value={planId} />
      <GoalFields />
    </FormDialog>
  );
}

export function EditGoalDialog({ goal }: { goal: Goal }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="sm">
          {tCommon("edit")}
        </Button>
      }
      title={`${tCommon("edit")} · ${goal.name}`}
      action={updateGoalAction}
      errorNamespace="plan"
    >
      <input type="hidden" name="goalId" value={goal.id} />
      <GoalFields goal={goal} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="status">{t("goalStatus")}</Label>
        <select
          id="status"
          name="status"
          defaultValue={goal.status === "abandoned" ? "abandoned" : "active"}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="active">{t("goalStatuses.active")}</option>
          <option value="abandoned">{t("goalStatuses.abandoned")}</option>
        </select>
      </div>
    </FormDialog>
  );
}
