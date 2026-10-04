CREATE TYPE "public"."activity_action" AS ENUM('FILE_CREATED', 'FILE_OPENED', 'FILE_EDITED', 'FILE_SHARED', 'FILE_MOVED', 'FILE_RENAMED', 'FILE_DELETED', 'FILE_RESTORED', 'FILE_DOWNLOADED', 'FILE_COPIED', 'FILE_PERMANENTLY_DELETED', 'FILE_VERSION_UPLOADED', 'FILE_VERSION_RESTORED', 'FOLDER_CREATED', 'FOLDER_RENAMED', 'FOLDER_MOVED', 'FOLDER_DELETED', 'FOLDER_RESTORED', 'FOLDER_SHARED', 'FOLDER_COPIED', 'FOLDER_PERMANENTLY_DELETED', 'PERMISSION_CHANGED', 'PERMISSION_REMOVED', 'LINK_SHARING_CHANGED', 'COMMENT_ADDED', 'FORM_PUBLISHED', 'FORM_UNPUBLISHED', 'FORM_RESPONSE_SUBMITTED');--> statement-breakpoint
CREATE TYPE "public"."cell_data_type" AS ENUM('EMPTY', 'NUMBER', 'STRING', 'BOOLEAN', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('DOCUMENT', 'SPREADSHEET', 'FORM', 'PDF', 'IMAGE', 'VIDEO', 'AUDIO', 'TEXT', 'ARCHIVE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."form_field_type" AS ENUM('SHORT_ANSWER', 'PARAGRAPH', 'MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN', 'DATE', 'TIME', 'NUMBER', 'EMAIL', 'RATING', 'LINEAR_SCALE', 'FILE_UPLOAD', 'SECTION');--> statement-breakpoint
CREATE TYPE "public"."general_access" AS ENUM('RESTRICTED', 'ANYONE_WITH_LINK');--> statement-breakpoint
CREATE TYPE "public"."grant_source" AS ENUM('DIRECT', 'LINK');--> statement-breakpoint
CREATE TYPE "public"."logic_action" AS ENUM('GO_TO_SECTION', 'SUBMIT_FORM');--> statement-breakpoint
CREATE TYPE "public"."logic_operator" AS ENUM('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'ANSWERED', 'NOT_ANSWERED', 'ALWAYS');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('SHARED_WITH_YOU', 'MENTIONED', 'COMMENTED', 'COMMENT_REPLIED', 'PERMISSION_CHANGED', 'FILE_MOVED', 'FORM_RESPONSE', 'COPY_COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('FILE', 'FOLDER');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'DELETED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_name_length" CHECK (char_length("users"."name") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE "drive_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"folder_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"storage_key" text,
	"checksum" text,
	"thumbnail_url" text,
	"description" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"trashed_by_parent" boolean DEFAULT false NOT NULL,
	"general_access" "general_access" DEFAULT 'RESTRICTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_files_size_non_negative" CHECK ("drive_files"."size" >= 0),
	CONSTRAINT "drive_files_name_length" CHECK (char_length("drive_files"."name") between 1 and 255),
	CONSTRAINT "drive_files_blob_has_storage" CHECK ("drive_files"."file_type" in ('DOCUMENT', 'SPREADSHEET', 'FORM') or "drive_files"."storage_key" is not null),
	CONSTRAINT "drive_files_trash_consistency" CHECK (("drive_files"."is_trashed" and "drive_files"."trashed_at" is not null) or (not "drive_files"."is_trashed" and not "drive_files"."trashed_by_parent"))
);
--> statement-breakpoint
CREATE TABLE "drive_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"is_root" boolean DEFAULT false NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp with time zone,
	"trashed_by_parent" boolean DEFAULT false NOT NULL,
	"general_access" "general_access" DEFAULT 'RESTRICTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_folders_root_shape" CHECK (("drive_folders"."is_root" and "drive_folders"."parent_id" is null) or (not "drive_folders"."is_root" and "drive_folders"."parent_id" is not null)),
	CONSTRAINT "drive_folders_not_own_parent" CHECK ("drive_folders"."parent_id" is null or "drive_folders"."parent_id" <> "drive_folders"."id"),
	CONSTRAINT "drive_folders_name_length" CHECK (char_length("drive_folders"."name") between 1 and 255),
	CONSTRAINT "drive_folders_trash_consistency" CHECK (("drive_folders"."is_trashed" and "drive_folders"."trashed_at" is not null) or (not "drive_folders"."is_trashed" and not "drive_folders"."trashed_by_parent"))
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_versions_file_version_unique" UNIQUE("file_id","version_number"),
	CONSTRAINT "file_versions_number_positive" CHECK ("file_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stars_exactly_one_target" CHECK (num_nonnulls("stars"."file_id", "stars"."folder_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "file_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"can_share" boolean DEFAULT false NOT NULL,
	"can_download" boolean DEFAULT true NOT NULL,
	"can_copy" boolean DEFAULT true NOT NULL,
	"source" "grant_source" DEFAULT 'DIRECT' NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_permissions_file_user_unique" UNIQUE("file_id","user_id"),
	CONSTRAINT "file_permissions_not_owner" CHECK ("file_permissions"."role" <> 'OWNER')
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"can_share" boolean DEFAULT false NOT NULL,
	"can_download" boolean DEFAULT true NOT NULL,
	"can_copy" boolean DEFAULT true NOT NULL,
	"source" "grant_source" DEFAULT 'DIRECT' NOT NULL,
	"invited_by" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_shares_target_matches_type" CHECK (("file_shares"."resource_type" = 'FILE' and "file_shares"."file_id" is not null and "file_shares"."folder_id" is null) or ("file_shares"."resource_type" = 'FOLDER' and "file_shares"."folder_id" is not null and "file_shares"."file_id" is null)),
	CONSTRAINT "file_shares_not_owner" CHECK ("file_shares"."role" <> 'OWNER')
);
--> statement-breakpoint
CREATE TABLE "folder_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"can_share" boolean DEFAULT false NOT NULL,
	"can_download" boolean DEFAULT true NOT NULL,
	"can_copy" boolean DEFAULT true NOT NULL,
	"source" "grant_source" DEFAULT 'DIRECT' NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_permissions_folder_user_unique" UNIQUE("folder_id","user_id"),
	CONSTRAINT "folder_permissions_not_owner" CHECK ("folder_permissions"."role" <> 'OWNER')
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"token" text NOT NULL,
	"permission" "role" DEFAULT 'VIEWER' NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "share_links_target_matches_type" CHECK (("share_links"."resource_type" = 'FILE' and "share_links"."file_id" is not null and "share_links"."folder_id" is null) or ("share_links"."resource_type" = 'FOLDER' and "share_links"."folder_id" is not null and "share_links"."file_id" is null)),
	CONSTRAINT "share_links_not_owner" CHECK ("share_links"."permission" <> 'OWNER'),
	CONSTRAINT "share_links_token_length" CHECK (char_length("share_links"."token") >= 32)
);
--> statement-breakpoint
CREATE TABLE "document_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_collaborators" (
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_collaborators_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "document_comment_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"mentioned_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_comment_replies_body_length" CHECK (char_length("document_comment_replies"."body") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"anchor_id" text NOT NULL,
	"quoted_text" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"mentioned_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_comments_body_length" CHECK (char_length("document_comments"."body") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "document_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"anchor_id" text NOT NULL,
	"original_text" text NOT NULL,
	"suggested_text" text NOT NULL,
	"status" "suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" text,
	"content" jsonb NOT NULL,
	"ydoc_state" "bytea",
	"word_count" integer DEFAULT 0 NOT NULL,
	"is_auto" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_doc_version_unique" UNIQUE("document_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"ydoc_state" "bytea",
	"plain_text" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(plain_text, ''))) STORED,
	"created_by" uuid,
	"last_edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_cells" (
	"sheet_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"input" text DEFAULT '' NOT NULL,
	"formula" text,
	"data_type" "cell_data_type" DEFAULT 'EMPTY' NOT NULL,
	"value_number" double precision,
	"value_text" text,
	"value_boolean" boolean,
	"formatted_value" text DEFAULT '' NOT NULL,
	"style" jsonb,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_cells_sheet_id_row_col_pk" PRIMARY KEY("sheet_id","row","col"),
	CONSTRAINT "spreadsheet_cells_position_non_negative" CHECK ("spreadsheet_cells"."row" >= 0 and "spreadsheet_cells"."col" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_collaborators" (
	"spreadsheet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_collaborators_spreadsheet_id_user_id_pk" PRIMARY KEY("spreadsheet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spreadsheet_id" uuid NOT NULL,
	"sheet_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"mentioned_user_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_comments_body_length" CHECK (char_length("spreadsheet_comments"."body") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spreadsheet_id" uuid NOT NULL,
	"sheet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_row" integer NOT NULL,
	"end_row" integer NOT NULL,
	"start_col" integer NOT NULL,
	"end_col" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_ranges_bounds" CHECK ("spreadsheet_ranges"."start_row" <= "spreadsheet_ranges"."end_row" and "spreadsheet_ranges"."start_col" <= "spreadsheet_ranges"."end_col" and "spreadsheet_ranges"."start_row" >= 0 and "spreadsheet_ranges"."start_col" >= 0)
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spreadsheet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"row_count" integer DEFAULT 1000 NOT NULL,
	"col_count" integer DEFAULT 26 NOT NULL,
	"frozen_rows" integer DEFAULT 0 NOT NULL,
	"frozen_cols" integer DEFAULT 0 NOT NULL,
	"col_widths" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"row_heights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_sheets_frozen_non_negative" CHECK ("spreadsheet_sheets"."frozen_rows" >= 0 and "spreadsheet_sheets"."frozen_cols" >= 0),
	CONSTRAINT "spreadsheet_sheets_dimensions" CHECK ("spreadsheet_sheets"."row_count" between 1 and 100000 and "spreadsheet_sheets"."col_count" between 1 and 702)
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spreadsheet_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" text,
	"revision" bigint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"cell_count" integer DEFAULT 0 NOT NULL,
	"is_auto" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_versions_version_unique" UNIQUE("spreadsheet_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "spreadsheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"last_edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_collaborators" (
	"form_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_collaborators_form_id_user_id_pk" PRIMARY KEY("form_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "form_field_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"type" "form_field_type" NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"validation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_fields_section_not_required" CHECK ("form_fields"."type" <> 'SECTION' or not "form_fields"."required")
);
--> statement-breakpoint
CREATE TABLE "form_logic_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"operator" "logic_operator" NOT NULL,
	"value" text,
	"action" "logic_action" NOT NULL,
	"target_section_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_logic_rules_target" CHECK ("form_logic_rules"."action" = 'SUBMIT_FORM' or "form_logic_rules"."target_section_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "form_response_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"value_text" text,
	"value_number" double precision,
	"value_date" date,
	"value_json" jsonb,
	CONSTRAINT "form_response_answers_response_field_unique" UNIQUE("response_id","field_id"),
	CONSTRAINT "form_response_answers_has_value" CHECK (num_nonnulls("form_response_answers"."value_text", "form_response_answers"."value_number", "form_response_answers"."value_date", "form_response_answers"."value_json") = 1)
);
--> statement-breakpoint
CREATE TABLE "form_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"respondent_id" uuid,
	"respondent_email" text,
	"ip_address" "inet",
	"user_agent" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_themes" (
	"form_id" uuid PRIMARY KEY NOT NULL,
	"primary_color" text DEFAULT '#673ab7' NOT NULL,
	"background_color" text DEFAULT '#f0ebf8' NOT NULL,
	"font_family" text DEFAULT 'sans' NOT NULL,
	"header_image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"response_id" uuid,
	"uploader_id" uuid,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"accepting_responses" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forms_view_count_non_negative" CHECK ("forms"."view_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"resource_type" text,
	"resource_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "activity_action" NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"event" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"ip_address" text,
	"user_agent" text,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_parent_id_drive_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_folder_id_drive_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."drive_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_collaborators" ADD CONSTRAINT "document_collaborators_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_collaborators" ADD CONSTRAINT "document_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment_replies" ADD CONSTRAINT "document_comment_replies_comment_id_document_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment_replies" ADD CONSTRAINT "document_comment_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_suggestions" ADD CONSTRAINT "document_suggestions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_cells" ADD CONSTRAINT "spreadsheet_cells_sheet_id_spreadsheet_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."spreadsheet_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_cells" ADD CONSTRAINT "spreadsheet_cells_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_collaborators" ADD CONSTRAINT "spreadsheet_collaborators_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_collaborators" ADD CONSTRAINT "spreadsheet_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_comments" ADD CONSTRAINT "spreadsheet_comments_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_comments" ADD CONSTRAINT "spreadsheet_comments_sheet_id_spreadsheet_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."spreadsheet_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_comments" ADD CONSTRAINT "spreadsheet_comments_parent_id_spreadsheet_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."spreadsheet_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_comments" ADD CONSTRAINT "spreadsheet_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_ranges" ADD CONSTRAINT "spreadsheet_ranges_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_ranges" ADD CONSTRAINT "spreadsheet_ranges_sheet_id_spreadsheet_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."spreadsheet_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_ranges" ADD CONSTRAINT "spreadsheet_ranges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_sheets" ADD CONSTRAINT "spreadsheet_sheets_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_versions" ADD CONSTRAINT "spreadsheet_versions_spreadsheet_id_spreadsheets_id_fk" FOREIGN KEY ("spreadsheet_id") REFERENCES "public"."spreadsheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_versions" ADD CONSTRAINT "spreadsheet_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheets" ADD CONSTRAINT "spreadsheets_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_collaborators" ADD CONSTRAINT "form_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_field_options" ADD CONSTRAINT "form_field_options_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_section_id_form_fields_id_fk" FOREIGN KEY ("target_section_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_response_answers" ADD CONSTRAINT "form_response_answers_response_id_form_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."form_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_response_answers" ADD CONSTRAINT "form_response_answers_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_themes" ADD CONSTRAINT "form_themes_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_field_id_form_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_response_id_form_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."form_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_uploads" ADD CONSTRAINT "form_uploads_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_file_id_drive_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."drive_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "email_verifications_hash_unique" ON "email_verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verifications_user_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_hash_unique" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drive_files_owner_id_idx" ON "drive_files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "drive_files_folder_id_idx" ON "drive_files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "drive_files_is_trashed_idx" ON "drive_files" USING btree ("is_trashed");--> statement-breakpoint
CREATE INDEX "drive_files_updated_at_idx" ON "drive_files" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "drive_files_folder_trashed_name_idx" ON "drive_files" USING btree ("folder_id","is_trashed","name");--> statement-breakpoint
CREATE INDEX "drive_files_owner_trashed_updated_idx" ON "drive_files" USING btree ("owner_id","is_trashed","updated_at");--> statement-breakpoint
CREATE INDEX "drive_files_mime_type_idx" ON "drive_files" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "drive_files_name_trgm_idx" ON "drive_files" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "drive_folders_owner_id_idx" ON "drive_folders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "drive_folders_parent_id_idx" ON "drive_folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "drive_folders_parent_trashed_name_idx" ON "drive_folders" USING btree ("parent_id","is_trashed","name");--> statement-breakpoint
CREATE INDEX "drive_folders_owner_trashed_idx" ON "drive_folders" USING btree ("owner_id","is_trashed","trashed_at");--> statement-breakpoint
CREATE INDEX "drive_folders_name_trgm_idx" ON "drive_folders" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "drive_folders_one_root_per_owner" ON "drive_folders" USING btree ("owner_id") WHERE "drive_folders"."is_root";--> statement-breakpoint
CREATE UNIQUE INDEX "stars_user_file_unique" ON "stars" USING btree ("user_id","file_id") WHERE "stars"."file_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stars_user_folder_unique" ON "stars" USING btree ("user_id","folder_id") WHERE "stars"."folder_id" is not null;--> statement-breakpoint
CREATE INDEX "file_permissions_file_id_idx" ON "file_permissions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_permissions_user_id_idx" ON "file_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_shares_email_idx" ON "file_shares" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "file_shares_file_email_unique" ON "file_shares" USING btree ("file_id","email") WHERE "file_shares"."file_id" is not null and "file_shares"."accepted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "file_shares_folder_email_unique" ON "file_shares" USING btree ("folder_id","email") WHERE "file_shares"."folder_id" is not null and "file_shares"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "folder_permissions_folder_id_idx" ON "folder_permissions" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "folder_permissions_user_id_idx" ON "folder_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_token_unique" ON "share_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_active_file_unique" ON "share_links" USING btree ("file_id") WHERE "share_links"."file_id" is not null and "share_links"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_active_folder_unique" ON "share_links" USING btree ("folder_id") WHERE "share_links"."folder_id" is not null and "share_links"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "document_assets_document_idx" ON "document_assets" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_comment_replies_comment_idx" ON "document_comment_replies" USING btree ("comment_id","created_at");--> statement-breakpoint
CREATE INDEX "document_comments_document_idx" ON "document_comments" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "document_suggestions_document_idx" ON "document_suggestions" USING btree ("document_id","status");--> statement-breakpoint
CREATE INDEX "document_versions_doc_created_idx" ON "document_versions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_file_id_unique" ON "documents" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "documents_search_idx" ON "documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "spreadsheet_cells_sheet_col_row_idx" ON "spreadsheet_cells" USING btree ("sheet_id","col","row");--> statement-breakpoint
CREATE INDEX "spreadsheet_comments_sheet_cell_idx" ON "spreadsheet_comments" USING btree ("sheet_id","row","col");--> statement-breakpoint
CREATE UNIQUE INDEX "spreadsheet_ranges_name_unique" ON "spreadsheet_ranges" USING btree ("spreadsheet_id",upper("name"));--> statement-breakpoint
CREATE INDEX "spreadsheet_sheets_spreadsheet_idx" ON "spreadsheet_sheets" USING btree ("spreadsheet_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "spreadsheet_sheets_name_unique" ON "spreadsheet_sheets" USING btree ("spreadsheet_id",lower("name"));--> statement-breakpoint
CREATE INDEX "spreadsheet_versions_created_idx" ON "spreadsheet_versions" USING btree ("spreadsheet_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "spreadsheets_file_id_unique" ON "spreadsheets" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "form_field_options_field_idx" ON "form_field_options" USING btree ("field_id","position");--> statement-breakpoint
CREATE INDEX "form_fields_form_position_idx" ON "form_fields" USING btree ("form_id","position");--> statement-breakpoint
CREATE INDEX "form_logic_rules_field_idx" ON "form_logic_rules" USING btree ("field_id","position");--> statement-breakpoint
CREATE INDEX "form_logic_rules_form_idx" ON "form_logic_rules" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_response_answers_field_id_idx" ON "form_response_answers" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "form_responses_form_id_idx" ON "form_responses" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_responses_form_submitted_idx" ON "form_responses" USING btree ("form_id","submitted_at");--> statement-breakpoint
CREATE INDEX "form_responses_respondent_idx" ON "form_responses" USING btree ("form_id","respondent_id");--> statement-breakpoint
CREATE INDEX "form_uploads_response_idx" ON "form_uploads" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "form_uploads_orphan_idx" ON "form_uploads" USING btree ("created_at") WHERE "form_uploads"."response_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "forms_file_id_unique" ON "forms" USING btree ("file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forms_public_id_unique" ON "forms" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_logs_resource_id_idx" ON "activity_logs" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "activity_logs_resource_created_idx" ON "activity_logs" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_user_action_created_idx" ON "activity_logs" USING btree ("user_id","action","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");