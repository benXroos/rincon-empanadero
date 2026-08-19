import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | undefined;

/**
 * Lazily builds the Drizzle client on first use rather than at import time.
 * Next.js evaluates route modules during build-time page-data collection,
 * so throwing here at module scope would break `pnpm build` in any
 * environment without DATABASE_URL set — including this scaffolding phase,
 * which intentionally ships with no live Neon credentials yet.
 */
export function getDb(): Db {
  if (cached) {
    return cached;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env.local (see README.md) to point at a Neon (or local Postgres) connection string.",
    );
  }

  const sql = neon(connectionString);
  cached = drizzle(sql, { schema });
  return cached;
}
