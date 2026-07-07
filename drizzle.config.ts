import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db/url";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: getDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
