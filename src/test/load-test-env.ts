import { config } from "dotenv";
import { existsSync } from "node:fs";

/**
 * Tests must never write to the real Neon database. Prefer `.env.test.local`
 * (a separate Neon branch) when it exists; fall back to `.env.local` only
 * when no test database has been configured yet, so integration/E2E tests
 * still run (against the real DB, with a loud reason why) instead of
 * silently skipping.
 */
const TEST_ENV_PATH = ".env.test.local";

config({ path: existsSync(TEST_ENV_PATH) ? TEST_ENV_PATH : ".env.local" });
