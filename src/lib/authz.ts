import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { STAGES, users, type Stage } from "@/db/schema";
import type { Session } from "@/lib/auth/token";

// Stage-keyed permission matrix — the heart of the growth axis. Bumping a
// child's stage in Settings shifts their rights here with zero migrations.
// This is data, not code: UI may consult it to hide buttons (cosmetic), but
// assertCan() below is the single authoritative gate, called by every
// service mutation.

type Rule = {
  guardian: boolean;
  // Minimum stage at which the child may do this to THEMSELVES; null = never.
  childMinStage: Stage | null;
};

export const PERMISSIONS = {
  "plan.edit": { guardian: true, childMinStage: "child_led" },
  "habit.create": { guardian: true, childMinStage: "child_led" },
  "habit.edit": { guardian: true, childMinStage: "child_led" },
  "goal.create": { guardian: true, childMinStage: "co_authored" },
  "goal.complete": { guardian: true, childMinStage: "autonomous" },
  "checkin.self": { guardian: false, childMinStage: "co_authored" },
  "checkin.direct_log": { guardian: true, childMinStage: null },
  "checkin.confirm": { guardian: true, childMinStage: "autonomous" },
  "ledger.adjust": { guardian: true, childMinStage: null },
  "ledger.reverse": { guardian: true, childMinStage: null },
  "penalty.create": { guardian: true, childMinStage: null },
  "reward.manage": { guardian: true, childMinStage: null },
  "redemption.request": { guardian: false, childMinStage: "co_authored" },
  "redemption.approve": { guardian: true, childMinStage: null },
  "review.write": { guardian: true, childMinStage: "co_authored" },
  "family.manage": { guardian: true, childMinStage: null },
} as const satisfies Record<string, Rule>;

export type Action = keyof typeof PERMISSIONS;

export class AuthzError extends Error {
  constructor(action: Action) {
    super(`not allowed: ${action}`);
    this.name = "AuthzError";
  }
}

function stageRank(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/**
 * The authorization choke point. Checks, all server-side:
 * 1. a targeted child belongs to the actor's family;
 * 2. guardians only do guardian-allowed actions;
 * 3. children only act on THEMSELVES, and only if their current stage
 *    (read fresh from the DB — never from the token) is high enough.
 */
export async function assertCan(
  db: Db,
  session: Session,
  action: Action,
  targetChildId?: string,
): Promise<void> {
  const rule: Rule = PERMISSIONS[action];

  if (session.role === "guardian") {
    if (!rule.guardian) throw new AuthzError(action);
    if (targetChildId) {
      const target = await db.query.users.findFirst({
        where: eq(users.id, targetChildId),
        columns: { familyId: true, role: true },
      });
      if (
        !target ||
        target.role !== "child" ||
        target.familyId !== session.familyId
      ) {
        throw new AuthzError(action);
      }
    }
    return;
  }

  if (!rule.childMinStage) throw new AuthzError(action);
  if (!targetChildId || targetChildId !== session.userId) {
    throw new AuthzError(action);
  }
  const self = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { stage: true, role: true },
  });
  if (
    !self ||
    self.role !== "child" ||
    !self.stage ||
    stageRank(self.stage) < stageRank(rule.childMinStage)
  ) {
    throw new AuthzError(action);
  }
}
