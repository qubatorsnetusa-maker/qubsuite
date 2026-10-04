ALTER TABLE "users" ADD COLUMN "is_pro" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drive_files" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drive_folders" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "drive_files_expires_at_idx" ON "drive_files" USING btree ("expires_at");