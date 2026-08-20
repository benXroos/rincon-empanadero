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

/**
 * CORRECTION (post-Phase-3): a pack's sale price is its OWN admin-editable
 * fixed price per channel — NOT derived by summing its chosen flavors'
 * prices. Owner-confirmed against the real current storefront: individual
 * empanada = $2500, but Docena (12) = $25000 and Media Docena (6) = $13000,
 * both well below the naive per-flavor sum (12×2500=$30000, 6×2500=$15000).
 * Packs carry no per-flavor surcharge regardless of which flavors are
 * chosen. Mirrors `price_list_items`'s exact shape/pattern, keyed by
 * `packId` instead of `flavorId` — a pack's price is looked up here, never
 * computed from `price_list_items`.
 */
export const packPriceListItems = pgTable(
  "pack_price_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id),
    channel: salesChannelEnum("channel").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.packId, table.channel)],
);

export type PackPriceListItem = typeof packPriceListItems.$inferSelect;
export type NewPackPriceListItem = typeof packPriceListItems.$inferInsert;

/**
 * sales-orders capability (spec "Record orders per channel"). A sale is a
 * COMPLETED-SALE record — no pending/paid/fulfilled state machine (MVP
 * scope decision resolving the proposal's unstated order-state-machine
 * ambiguity: if a sale is being recorded, it happened). `paymentMethod` is
 * scoped to the confirmed MVP payment methods only — no Mercado Pago.
 * `totalAmount` is the sum of its lines' `lineTotal`, computed once at
 * creation by `features/sales-orders/domain/compute-sale-totals.ts` and
 * stored as-is (never recomputed from the lines at read time), so a later
 * catalog re-price never rewrites a historical sale's total — the exact
 * snapshot discipline design decision #7 established for `pricing_profile`.
 */
export const paymentMethodEnum = pgEnum("payment_method", ["transfer", "cash"]);

/**
 * `fulfillment_method` (spec "Delivery-or-pickup fulfillment choice", added
 * in Phase 6b) is recorded on `sales_orders` ONLY for orders placed through
 * the new public checkout action — nullable because a staff-entered sale
 * via `registerSale` (manual walk-in/phone entry) has no fulfillment
 * concept. `postalCode` below is likewise nullable and only meaningful when
 * `fulfillmentMethod` is `"delivery"`. Both are additive columns on this
 * already-existing Phase 5 table — no existing column changed.
 */
export const fulfillmentMethodEnum = pgEnum("fulfillment_method", ["pickup", "delivery"]);

export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: salesChannelEnum("channel").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  fulfillmentMethod: fulfillmentMethodEnum("fulfillment_method"),
  postalCode: text("postal_code"),
});

export type SalesOrder = typeof salesOrders.$inferSelect;
export type NewSalesOrder = typeof salesOrders.$inferInsert;

/**
 * `sale_item_type` distinguishes whether a line references a `flavor` (an
 * individually-sold unit) or a `pack` (docena/media docena) — the same two
 * sellable shapes `product-catalog` already prices independently via
 * `price_list_items`/`pack_price_list_items`. `itemId` intentionally has NO
 * foreign key: it is polymorphic (a flavor id or a pack id depending on
 * `itemType`), so a single FK constraint cannot express it; referential
 * integrity for `itemId` is the caller's responsibility (the application
 * layer resolves and validates the item before calling `registerSale`).
 * `unitPriceSnapshot`/`lineTotal` are the frozen price-at-time-of-sale —
 * never a live join back to `price_list_items`/`pack_price_list_items`.
 */
export const saleItemTypeEnum = pgEnum("sale_item_type", ["flavor", "pack"]);

export const salesOrderLines = pgTable("sales_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id),
  itemType: saleItemTypeEnum("item_type").notNull(),
  itemId: uuid("item_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type NewSalesOrderLine = typeof salesOrderLines.$inferInsert;

/**
 * online-storefront capability (spec "Cart, discounts, shipping,
 * fulfillment, checkout"). Admin-configurable discount codes — MVP GAP NOTE:
 * the owner's old Empretienda site had discount codes, but the exact rules
 * (single-use? expiry?) were never captured precisely. This is the simplest
 * model that satisfies the spec: a code is `percentage` or `fixed_amount`,
 * carries one `value`, and an `active` toggle — no expiry/usage-limit
 * columns. See `features/online-storefront/domain/discount.ts`. The owner
 * must review the actual codes/values before going live; the mechanism is
 * intentionally simple and swappable.
 */
export const discountCodeTypeEnum = pgEnum("discount_code_type", ["percentage", "fixed_amount"]);

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  type: discountCodeTypeEnum("type").notNull(),
  value: numeric("value", { precision: 12, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;

/**
 * online-storefront capability (spec "Cart, discounts, shipping,
 * fulfillment, checkout"). Admin-configurable shipping cost by postal-code
 * PREFIX (see `features/online-storefront/domain/shipping.ts` for why a
 * prefix table was chosen over a single flat rate) — `postalCodePrefix` is
 * unique so `upsertShippingRate` can update a zone's rate in place. MVP GAP
 * NOTE, same discipline as `discountCodes`: this batch only builds the
 * mechanism — the owner must review the actual configured zones/rates
 * before going live.
 */
export const shippingRates = pgTable("shipping_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  postalCodePrefix: text("postal_code_prefix").notNull().unique(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShippingRate = typeof shippingRates.$inferSelect;
export type NewShippingRate = typeof shippingRates.$inferInsert;
