// Minimal in-memory sliding-window rate limiter. Per-instance and ephemeral
// on Vercel — like the PIN lockout, that's an accepted family-scale tradeoff:
// it exists to stop casual enumeration, not determined attackers.
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export function rateLimitExceeded(
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > max;
}
