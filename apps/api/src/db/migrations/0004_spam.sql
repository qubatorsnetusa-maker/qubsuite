CREATE TABLE "spam_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spam_exactly_one_target" CHECK (num_nonnulls("spam_items"."file_id", "spam_items"."folder_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "user_blocks" (
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_blocks_user_id_blocked_user_id_pk" PRIMARY KEY("user_id","blocked_user_id"),
	CONSTRAINT "user_blocks_not_self" CHECK ("user_blocks"."user_id" <> "user_blocks"."blocked_user_id")
);
--> statement-breakpoint
ALTER TABLE "spam_items" ADD CONSTRAINT "spam_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spam_items" ADD CONSTRAINT "spam_items_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spam_items" ADD CONSTRAINT "spam_items_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "spam_user_file_unique" ON "spam_items" USING btree ("user_id","file_id") WHERE "spam_items"."file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "spam_user_folder_unique" ON "spam_items" USING btree ("user_id","folder_id") WHERE "spam_items"."folder_id" is not null;--> statement-breakpoint
CREATE INDEX "spam_created_idx" ON "spam_items" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_user_id");