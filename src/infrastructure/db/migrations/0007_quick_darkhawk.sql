CREATE TYPE "public"."purchase_category" AS ENUM('proteins_dairy', 'produce', 'prepared_fillings', 'packaging', 'supplies');--> statement-breakpoint
CREATE TABLE "decomiso_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flavor_id" uuid NOT NULL,
	"quantity_wasted" numeric(12, 4) NOT NULL,
	"waste_date" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" text NOT NULL,
	"category" "purchase_category" NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"total_cost" numeric(12, 4) NOT NULL,
	"purchase_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decomiso_logs" ADD CONSTRAINT "decomiso_logs_flavor_id_flavors_id_fk" FOREIGN KEY ("flavor_id") REFERENCES "public"."flavors"("id") ON DELETE no action ON UPDATE no action;