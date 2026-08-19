CREATE TABLE "pack_price_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_price_list_items_pack_id_channel_unique" UNIQUE("pack_id","channel")
);
--> statement-breakpoint
ALTER TABLE "pack_price_list_items" ADD CONSTRAINT "pack_price_list_items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE no action ON UPDATE no action;