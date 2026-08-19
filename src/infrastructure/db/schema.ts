import { pgTable, uuid, text, timestamp, pgEnum, numeric } from "drizzle-orm/pg-core";

/**
 * Core schema. Business-capability tables are added feature-by-feature
 * starting in Phase 2 — see sdd/rincon-empanadero-management-app/design.
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

/**
 * pricing-engine capability (design decision #7): append-only, versioned
 * per sales channel. A percentage change inserts a NEW row with a new
 * `effectiveFrom` — existing rows are never updated or deleted, so an
 * order's cost snapshot (Phase 5) always resolves against the version that
 * was active on its own date, regardless of later profile changes.
 */
export const salesChannelEnum = pgEnum("sales_channel", ["own", "pedidosya"]);

export const pricingProfiles = pgTable("pricing_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: salesChannelEnum("channel").notNull(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  decomisoPct: numeric("decomiso_pct", { precision: 6, scale: 4 }).notNull(),
  gananciaDeseadaPct: numeric("ganancia_deseada_pct", { precision: 6, scale: 4 }).notNull(),
  comisionPlataformaPct: numeric("comision_plataforma_pct", { precision: 6, scale: 4 }).notNull(),
  ivaComisionPct: numeric("iva_comision_pct", { precision: 6, scale: 4 }).notNull(),
  comisionTarjetasPct: numeric("comision_tarjetas_pct", { precision: 6, scale: 4 }).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PricingProfileRow = typeof pricingProfiles.$inferSelect;
export type NewPricingProfileRow = typeof pricingProfiles.$inferInsert;
