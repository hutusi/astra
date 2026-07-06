import fs from "node:fs";
import path from "node:path";

/**
 * Single resolution point for the database URL. Local dev falls back to a
 * SQLite file under data/; production sets DATABASE_URL to a Turso libsql://
 * URL (plus TURSO_AUTH_TOKEN). drizzle.config.ts and src/db/index.ts must
 * both import this so the CLI and the app never disagree on the target.
 */
export function getDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;

  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "astra.db")}`;
}
