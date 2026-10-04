CREATE TYPE "public"."platform_role" AS ENUM('USER', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "org_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"policies" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "org_settings_single_row" CHECK ("org_settings"."id" = 'org')
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" "platform_role" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "storage_quota_bytes" bigint;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_platform_role_idx" ON "users" USING btree ("platform_role") WHERE "users"."platform_role" <> 'USER';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_storage_quota_positive" CHECK ("users"."storage_quota_bytes" is null or "users"."storage_quota_bytes" > 0);