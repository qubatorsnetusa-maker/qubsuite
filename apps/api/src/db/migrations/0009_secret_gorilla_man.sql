CREATE TABLE "invite_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"target_url" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invite_tokens_hash_unique" ON "invite_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invite_tokens_email_idx" ON "invite_tokens" USING btree ("email");