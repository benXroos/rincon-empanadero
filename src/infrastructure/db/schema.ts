import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

/**
 * Core schema only. Business-capability tables (pricing_profile, product,
 * order, etc.) are added feature-by-feature starting in Phase 2 — see
 * sdd/rincon-empanadero-management-app/design.
 */

export const userRoleEnum = pgEnum("user_role", ["admin", "colaborador"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("colaborador"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
