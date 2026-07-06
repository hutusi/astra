// Dev/onboarding seed. Wipes and recreates the demo family — refuses to run
// against a remote database unless SEED_FORCE=1 (first-time prod setup).
// Runs under the Bun runtime: bun run seed
import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { families, users } from "../src/db/schema";
import { getDatabaseUrl } from "../src/db/url";

const url = getDatabaseUrl();
if (!url.startsWith("file:") && process.env.SEED_FORCE !== "1") {
  console.error(
    `Refusing to seed remote database (${url}). Set SEED_FORCE=1 to override.`,
  );
  process.exit(1);
}

const PARENT_PASSWORD = process.env.SEED_PARENT_PASSWORD ?? "astra-dev";
const CHILD_PIN = process.env.SEED_CHILD_PIN ?? "1234";

async function seed() {
  await db.delete(users);
  await db.delete(families);

  const [family] = await db
    .insert(families)
    .values({ name: "星河之家", code: "ASTRA", timezone: "Asia/Shanghai" })
    .returning();

  const passwordHash = await bcrypt.hash(PARENT_PASSWORD, 10);
  const pinHash = await bcrypt.hash(CHILD_PIN, 10);

  await db.insert(users).values([
    {
      familyId: family.id,
      role: "guardian",
      name: "爸爸",
      avatar: "👨",
      email: "papa@astra.family",
      passwordHash,
    },
    {
      familyId: family.id,
      role: "guardian",
      name: "妈妈",
      avatar: "👩",
      email: "mama@astra.family",
      passwordHash,
    },
    {
      familyId: family.id,
      role: "child",
      name: "小星",
      avatar: "🦖",
      pinHash,
      stage: "co_authored",
      birthdate: "2015-01-01",
    },
  ]);

  console.log(`Seeded family 星河之家 (code: ASTRA)
  guardian: papa@astra.family / ${PARENT_PASSWORD}
  guardian: mama@astra.family / ${PARENT_PASSWORD}
  child:    小星 (stage co_authored, PIN ${CHILD_PIN})`);
}

await seed();
process.exit(0);
