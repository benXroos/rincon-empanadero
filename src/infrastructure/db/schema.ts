import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  numeric,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PricingProfileRow = typeof pricingProfiles.$inferSelect;
export type NewPricingProfileRow = typeof pricingProfiles.$inferInsert;

/**
 * product-catalog capability (spec "product-catalog" + "online-storefront").
 * `product` groups flavors under one sellable line (e.g. "Empanada").
 * `flavor.isAvailable` is the admin-only toggle that must immediately hide a
 * flavor storefront-wide (spec scenario "Toggle hides from storefront"),
 * independent of any stock quantity.
 */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export const flavors = pgTable("flavors", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  costoMateriales: numeric("costo_materiales", { precision: 12, scale: 4 }).notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Flavor = typeof flavors.$inferSelect;
export type NewFlavor = typeof flavors.$inferInsert;

/**
 * `pack` is a multi-unit offering (docena/media docena). `pack_slot` is the
 * eligibility join between a pack and the flavors a customer may choose
 * from when building a mixed-flavor selection (spec "Mixed-flavor pack
 * selection") — it is NOT a fixed physical slot; `pack.unitCount` is the
 * total number of units the customer's flavor breakdown must sum to (see
 * `product-catalog/domain/pack-selection.ts`).
 */
export const packs = pgTable("packs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  unitCount: integer("unit_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Pack = typeof packs.$inferSelect;
export type NewPack = typeof packs.$inferInsert;

export const packSlots = pgTable(
  "pack_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id),
    flavorId: uuid("flavor_id")
      .notNull()
      .references(() => flavors.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.packId, table.flavorId)],
);

export type PackSlot = typeof packSlots.$inferSelect;
export type NewPackSlot = typeof packSlots.$inferInsert;

/**
 * Per-channel cached price for a flavor (design's `price_list_item(channel,
 * price)`). Recomputed via `product-catalog/domain/compute-flavor-price.ts`
 * whenever the flavor's cost or the channel's active `pricing_profile`
 * changes — own and PedidosYa resolve independently since their commission
 * profiles differ (spec "Per-channel pricing").
 */
export const priceListItems = pgTable(
  "price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    flavorId: uuid("flavor_id")
      .notNull()
      .references(() => flavors.id),
    channel: salesChannelEnum("channel").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.flavorId, table.channel)],
);

export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;
