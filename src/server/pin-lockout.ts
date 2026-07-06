// In-memory PIN brute-force guard. Per-instance and ephemeral on Vercel —
// acceptable at family scale (a child account can't spend anything without
// parent approval anyway).
const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Entry = { fails: number; lockedUntil: number };

const attempts = new Map<string, Entry>();

export function isLocked(childId: string): boolean {
  const entry = attempts.get(childId);
  return !!entry && entry.lockedUntil > Date.now();
}

export function recordPinFailure(childId: string): void {
  const entry = attempts.get(childId) ?? { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
    entry.fails = 0;
  }
  attempts.set(childId, entry);
}

export function clearPinFailures(childId: string): void {
  attempts.delete(childId);
}
