ALTER TYPE "public"."activity_action" ADD VALUE 'FILE_VERSION_DELETED' BEFORE 'FOLDER_CREATED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'STORAGE_CHANGED';--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secrets" text,
	"last_test_at" timestamp with time zone,
	"last_test_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "email_settings_single_row" CHECK ("email_settings"."id" = 'org')
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "storage_unlimited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_storage_unlimited_exclusive" CHECK (not ("users"."storage_unlimited" and "users"."storage_quota_bytes" is not null));