ALTER TYPE "public"."form_field_type" ADD VALUE 'PHONE';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'URL';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'DATETIME';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'YES_NO';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'OPINION_SCALE';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'NPS';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'EMOJI_RATING';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'SLIDER';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'RANKING';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'MATRIX';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'IMAGE_CHOICE';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'ADDRESS';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'SIGNATURE';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'CONSENT';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'HIDDEN';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'LOCATION';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'STATEMENT';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'IMAGE_BLOCK';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'VIDEO_BLOCK';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'WELCOME';--> statement-breakpoint
ALTER TYPE "public"."form_field_type" ADD VALUE 'ENDING';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'SHOW';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'HIDE';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'JUMP_TO_FIELD';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'END_FORM';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'REDIRECT';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'SHOW_MESSAGE';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'SET_VARIABLE';--> statement-breakpoint
ALTER TYPE "public"."logic_action" ADD VALUE 'CALCULATE';--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "ref" text;--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "placeholder" text;--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "default_value" jsonb;--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "score_config" jsonb;--> statement-breakpoint
UPDATE "form_fields" f SET "ref" = 'q' || s.n FROM (SELECT "id", row_number() OVER (PARTITION BY "form_id" ORDER BY "position", "id") AS n FROM "form_fields") s WHERE s."id" = f."id";--> statement-breakpoint
ALTER TABLE "form_fields" ALTER COLUMN "ref" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "form_fields_form_ref_unique" ON "form_fields" USING btree ("form_id","ref");--> statement-breakpoint
CREATE FUNCTION form_field_is_welcome(t form_field_type) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT t::text = 'WELCOME' $$;--> statement-breakpoint
CREATE UNIQUE INDEX "form_fields_one_welcome" ON "form_fields" USING btree ("form_id") WHERE form_field_is_welcome("type");--> statement-breakpoint
ALTER TABLE "form_fields" DROP CONSTRAINT "form_fields_section_not_required";--> statement-breakpoint
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_non_input_not_required" CHECK ("form_fields"."type"::text not in ('SECTION','STATEMENT','IMAGE_BLOCK','VIDEO_BLOCK','WELCOME','ENDING','HIDDEN') or not "form_fields"."required");--> statement-breakpoint
ALTER TABLE "form_field_options" ADD COLUMN "kind" text DEFAULT 'option' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_field_options" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "form_field_options" ADD COLUMN "value" text;--> statement-breakpoint
ALTER TABLE "form_field_options" ADD CONSTRAINT "form_field_options_kind" CHECK ("form_field_options"."kind" in ('option','row','column'));--> statement-breakpoint
CREATE TABLE "form_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"initial_value" jsonb,
	"formula" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_variables_type" CHECK ("form_variables"."type" in ('TEXT','NUMBER','BOOLEAN','DATE'))
);--> statement-breakpoint
ALTER TABLE "form_variables" ADD CONSTRAINT "form_variables_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_variables_form_key_unique" ON "form_variables" USING btree ("form_id","key");--> statement-breakpoint
ALTER TABLE "form_logic_rules" ALTER COLUMN "operator" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "trigger" text DEFAULT 'ON_LEAVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "scope" text DEFAULT 'FIELD' NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "condition" jsonb;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "target_field_id" uuid;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "target_variable_id" uuid;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD COLUMN "payload" jsonb;--> statement-breakpoint
UPDATE "form_logic_rules" SET "scope" = 'SECTION', "condition" = CASE "operator"
  WHEN 'ALWAYS' THEN '{"all":[]}'::jsonb
  ELSE jsonb_build_object(
    'subject', jsonb_build_object('type', 'field', 'id', "field_id"),
    'op', CASE "operator" WHEN 'EQUALS' THEN 'eq' WHEN 'NOT_EQUALS' THEN 'neq' WHEN 'CONTAINS' THEN 'contains' WHEN 'ANSWERED' THEN 'answered' WHEN 'NOT_ANSWERED' THEN 'unanswered' END,
    'value', "value")
END;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ALTER COLUMN "condition" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_field_id_form_fields_id_fk" FOREIGN KEY ("target_field_id") REFERENCES "public"."form_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target_variable_id_form_variables_id_fk" FOREIGN KEY ("target_variable_id") REFERENCES "public"."form_variables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_logic_rules_target_field_idx" ON "form_logic_rules" USING btree ("target_field_id");--> statement-breakpoint
ALTER TABLE "form_logic_rules" DROP CONSTRAINT "form_logic_rules_target";--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_target" CHECK (("form_logic_rules"."action"::text <> 'GO_TO_SECTION' or "form_logic_rules"."target_section_id" is not null) and ("form_logic_rules"."action"::text <> 'JUMP_TO_FIELD' or "form_logic_rules"."target_field_id" is not null) and ("form_logic_rules"."action"::text not in ('SET_VARIABLE','CALCULATE') or "form_logic_rules"."target_variable_id" is not null));--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_trigger" CHECK ("form_logic_rules"."trigger" in ('ON_LEAVE','VISIBILITY'));--> statement-breakpoint
ALTER TABLE "form_logic_rules" ADD CONSTRAINT "form_logic_rules_scope" CHECK ("form_logic_rules"."scope" in ('FIELD','SECTION'));--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "score" double precision;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "computed" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "ending_id" uuid;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "client_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "form_responses" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_ending_id_form_fields_id_fk" FOREIGN KEY ("ending_id") REFERENCES "public"."form_fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_responses_client_submission_unique" ON "form_responses" USING btree ("form_id","client_submission_id") WHERE "form_responses"."client_submission_id" is not null;
