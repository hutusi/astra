import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSessionToken,
  verifySessionToken,
  type Session,
} from "@/lib/auth/token";

export type { Session };

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
});

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// Layout/page guards. UX only — the authoritative gate is assertCan() in the
// service layer; see docs/DESIGN.md.
export async function requireGuardian(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "guardian") redirect("/child");
  return session;
}

export async function requireChild(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "child") redirect("/parent");
  return session;
}
