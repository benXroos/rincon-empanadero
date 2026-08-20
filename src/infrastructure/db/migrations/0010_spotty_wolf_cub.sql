CREATE TYPE "public"."pya_settlement_variance_status" AS ENUM('matched', 'mismatch', 'no_estimate_found');--> statement-breakpoint
CREATE TABLE "pya_settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"order_date" date NOT NULL,
	"gross_amount" numeric(12, 4) NOT NULL,
	"net_sale_amount" numeric(12, 4) NOT NULL,
	"service_fee_amount" numeric(12, 4) NOT NULL,
	"matched_estimate_id" uuid,
	"variance_status" "pya_settlement_variance_status" NOT NULL,
	"variance_amount" numeric(12, 4),
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pya_settlement_lines" ADD CONSTRAINT "pya_settlement_lines_matched_estimate_id_pya_daily_estimates_id_fk" FOREIGN KEY ("matched_estimate_id") REFERENCES "public"."pya_daily_estimates"("id") ON DELETE no action ON UPDATE no action;