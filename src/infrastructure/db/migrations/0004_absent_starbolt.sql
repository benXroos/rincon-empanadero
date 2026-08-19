CREATE TYPE "public"."payment_method" AS ENUM('transfer', 'cash');--> statement-breakpoint
CREATE TYPE "public"."sale_item_type" AS ENUM('flavor', 'pack');--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"item_type" "sale_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_snapshot" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"sold_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE no action ON UPDATE no action;