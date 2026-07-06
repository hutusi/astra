// Edge-safe JWT session token helpers — imported by both src/proxy.ts and
// src/lib/session.ts. Keep free of next/headers and DB imports.
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "astra_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — bedtime logins must survive

export type SessionRole = "guardian" | "child";

export type Session = {
  userId: string;
  familyId: string;
  role: SessionRole;
  name: string;
};

// Stage is deliberately NOT in the token: it changes over time and authz
// must always read it fresh from the DB (see src/lib/authz.ts).

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return new TextEncoder().encode("astra-dev-only-secret");
}

export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT({
    fam: session.familyId,
    role: session.role,
    name: session.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      !payload.sub ||
      typeof payload.fam !== "string" ||
      (payload.role !== "guardian" && payload.role !== "child")
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      familyId: payload.fam,
      role: payload.role,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}
