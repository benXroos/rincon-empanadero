CREATE TYPE "public"."pya_payment_method" AS ENUM('paid_in_app', 'cash_collected_by_store');--> statement-breakpoint
CREATE TABLE "pya_daily_estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"order_date" date NOT NULL,
	"gross_amount" numeric(12, 4) NOT NULL,
	"payment_method" "pya_payment_method" NOT NULL,
	"comision_total_used" numeric(6, 4) NOT NULL,
	"cash_in_till_today" numeric(12, 4) NOT NULL,
	"estimated_net_kept" numeric(12, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pya_daily_estimates_order_number_unique" UNIQUE("order_number")
);
