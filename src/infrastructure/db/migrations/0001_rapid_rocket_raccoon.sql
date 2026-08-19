CREATE TYPE "public"."sales_channel" AS ENUM('own', 'pedidosya');--> statement-breakpoint
CREATE TABLE "pricing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "sales_channel" NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"decomiso_pct" numeric(6, 4) NOT NULL,
	"ganancia_deseada_pct" numeric(6, 4) NOT NULL,
	"comision_plataforma_pct" numeric(6, 4) NOT NULL,
	"iva_comision_pct" numeric(6, 4) NOT NULL,
	"comision_tarjetas_pct" numeric(6, 4) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_profiles" ADD CONSTRAINT "pricing_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;