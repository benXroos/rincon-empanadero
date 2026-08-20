CREATE TYPE "public"."fulfillment_method" AS ENUM('pickup', 'delivery');--> statement-breakpoint
CREATE TABLE "shipping_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"postal_code_prefix" text NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_rates_postal_code_prefix_unique" UNIQUE("postal_code_prefix")
);
--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "fulfillment_method" "fulfillment_method";--> statement-breakpoint
ALTER TABLE "sales_orders" ADD COLUMN "postal_code" text;