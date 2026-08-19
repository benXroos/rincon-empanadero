import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/infrastructure/db/client";
import { users } from "../src/infrastructure/db/schema";
import { parseSeedAdminArgs } from "../src/core/auth/seed-admin";

/**
 * CLI-only user provisioning (Phase 4, task 4.2 — design decision #4:
 * accounts are admin-provisioned, there is no public signup form).
 * Idempotent: re-running with the same --email updates name/password/role
 * instead of failing, so it is safe to re-run against the real Neon DB
 * (e.g. to rotate a password or promote a colaborador to admin).
 *
 *   pnpm db:seed-admin -- --name="Ana" --email=ana@rinconempanadero.com --password=... --role=admin
 */
async function main() {
  const args = parseSeedAdminArgs(process.argv.slice(2));
  const passwordHash = await bcrypt.hash(args.password, 10);
  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.email, args.email)).limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ name: args.name, passwordHash, role: args.role })
      .where(eq(users.id, existing.id));
    console.log(`Updated existing user ${args.email} (${args.role}).`);
  } else {
    await db
      .insert(users)
      .values({ name: args.name, email: args.email, passwordHash, role: args.role });
    console.log(`Created user ${args.email} (${args.role}).`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
