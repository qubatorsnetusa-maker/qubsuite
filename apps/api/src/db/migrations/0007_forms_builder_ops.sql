CREATE TABLE "form_op_log" (
	"form_id" uuid NOT NULL,
	"tx_id" uuid NOT NULL,
	"user_id" uuid,
	"revision" integer NOT NULL,
	"assigned" jsonb DEFAULT '{"fields":{},"variables":{}}'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_op_log_form_id_tx_id_pk" PRIMARY KEY("form_id","tx_id")
);
--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "form_op_log" ADD CONSTRAINT "form_op_log_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_op_log" ADD CONSTRAINT "form_op_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "form_op_log_applied_idx" ON "form_op_log" USING btree ("form_id","applied_at");