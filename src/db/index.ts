import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { getDatabaseUrl } from "./url";

const url = getDatabaseUrl();

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

if (url.startsWith("file:")) {
  // Local SQLite only; Turso applies sane defaults server-side.
  void client.execute("PRAGMA journal_mode = WAL");
  void client.execute("PRAGMA busy_timeout = 5000");
  void client.execute("PRAGMA foreign_keys = ON");
}

export const db = drizzle(client, { schema });

export type Db = typeof db;
