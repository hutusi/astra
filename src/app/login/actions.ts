"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { families, users, type User } from "@/db/schema";
import { LOCALE_COOKIE } from "@/i18n/locale";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";
import {
  clearPinFailures,
  isLocked,
  recordPinFailure,
} from "@/server/pin-lockout";
import { rateLimitExceeded } from "@/server/rate-limit";

export type LoginError =
  | "invalidCredentials"
  | "familyNotFound"
  | "wrongPin"
  | "locked";

export type LoginState = { error: LoginError } | null;

async function establishSession(user: User): Promise<void> {
  await setSessionCookie({
    userId: user.id,
    familyId: user.familyId,
    role: user.role,
    name: user.name,
  });
  // Locale is read from this cookie on every request (src/i18n/request.ts);
  // sync it from the profile preference here so i18n never hits the DB.
  const store = await cookies();
  store.set(LOCALE_COOKIE, user.locale, {
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export async function loginGuardian(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "invalidCredentials" };

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), eq(users.role, "guardian")),
  });
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "invalidCredentials" };
  }

  await establishSession(user);
  redirect("/parent");
}

export type FamilyChildren = {
  familyName: string;
  children: Array<{ id: string; name: string; avatar: string }>;
};

export async function lookupFamilyChildren(
  code: string,
): Promise<FamilyChildren | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  // Family codes are short; don't let anyone enumerate them (the lookup
  // reveals children's names and avatars). 20 tries per 15 min per IP.
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimitExceeded(`family-lookup:${ip}`, 20, 15 * 60 * 1000)) {
    return null;
  }

  const family = await db.query.families.findFirst({
    where: eq(families.code, normalized),
  });
  if (!family) return null;

  const children = await db.query.users.findMany({
    where: and(eq(users.familyId, family.id), eq(users.role, "child")),
    columns: { id: true, name: true, avatar: true },
  });
  return { familyName: family.name, children };
}

export async function loginChild(
  childId: string,
  pin: string,
): Promise<LoginState> {
  if (isLocked(childId)) return { error: "locked" };

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, childId), eq(users.role, "child")),
  });
  if (!user?.pinHash || !(await bcrypt.compare(pin, user.pinHash))) {
    recordPinFailure(childId);
    return { error: isLocked(childId) ? "locked" : "wrongPin" };
  }

  clearPinFailures(childId);
  await establishSession(user);
  redirect("/child");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
