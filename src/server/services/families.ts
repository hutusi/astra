// Family membership management. Pure TS (no Next imports) so bun test can
// exercise it against an in-memory DB.
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { users, type Stage, type User } from "@/db/schema";
import type { Session } from "@/lib/auth/token";
import { assertCan } from "@/lib/authz";

export class FamilyError extends Error {
  constructor(public code: "nameTaken" | "emailTaken") {
    super(code);
    this.name = "FamilyError";
  }
}

const BCRYPT_COST = 10;

/** Family-scoped child fetch — the guard every /parent/children page needs. */
export async function getFamilyChild(
  db: Db,
  familyId: string,
  childId: string,
): Promise<User | null> {
  const child = await db.query.users.findFirst({
    where: and(
      eq(users.id, childId),
      eq(users.familyId, familyId),
      eq(users.role, "child"),
    ),
  });
  return child ?? null;
}

export async function listFamilyMembers(
  db: Db,
  familyId: string,
): Promise<{ children: User[]; guardians: User[] }> {
  const members = await db.query.users.findMany({
    where: eq(users.familyId, familyId),
    orderBy: (u, { asc }) => [asc(u.createdAt)],
  });
  return {
    children: members.filter((m) => m.role === "child"),
    guardians: members.filter((m) => m.role === "guardian"),
  };
}

export async function addChild(
  db: Db,
  session: Session,
  input: {
    name: string;
    avatar: string;
    pin: string;
    stage: Stage;
    birthdate?: string;
  },
): Promise<User> {
  await assertCan(db, session, "family.manage");
  await ensureNameFree(db, session.familyId, input.name);

  const [child] = await db
    .insert(users)
    .values({
      familyId: session.familyId,
      role: "child",
      name: input.name,
      avatar: input.avatar,
      pinHash: await bcrypt.hash(input.pin, BCRYPT_COST),
      stage: input.stage,
      birthdate: input.birthdate || null,
    })
    .returning();
  return child;
}

export async function updateChild(
  db: Db,
  session: Session,
  childId: string,
  input: {
    name?: string;
    avatar?: string;
    pin?: string;
    stage?: Stage;
    birthdate?: string;
    locale?: "zh" | "en";
  },
): Promise<void> {
  await assertCan(db, session, "family.manage", childId);

  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.name) {
    await ensureNameFree(db, session.familyId, input.name, childId);
    patch.name = input.name;
  }
  if (input.avatar) patch.avatar = input.avatar;
  if (input.pin) patch.pinHash = await bcrypt.hash(input.pin, BCRYPT_COST);
  if (input.stage) patch.stage = input.stage;
  if (input.birthdate !== undefined) patch.birthdate = input.birthdate || null;
  if (input.locale) patch.locale = input.locale;
  if (Object.keys(patch).length === 0) return;

  await db.update(users).set(patch).where(eq(users.id, childId));
}

export async function addGuardian(
  db: Db,
  session: Session,
  input: { name: string; avatar: string; email: string; password: string },
): Promise<User> {
  await assertCan(db, session, "family.manage");
  await ensureNameFree(db, session.familyId, input.name);

  const email = input.email.trim().toLowerCase();
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });
  if (existing) throw new FamilyError("emailTaken");

  const [guardian] = await db
    .insert(users)
    .values({
      familyId: session.familyId,
      role: "guardian",
      name: input.name,
      avatar: input.avatar,
      email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
    })
    .returning();
  return guardian;
}

async function ensureNameFree(
  db: Db,
  familyId: string,
  name: string,
  exceptUserId?: string,
): Promise<void> {
  const existing = await db.query.users.findFirst({
    where: and(eq(users.familyId, familyId), eq(users.name, name)),
    columns: { id: true },
  });
  if (existing && existing.id !== exceptUserId) {
    throw new FamilyError("nameTaken");
  }
}
