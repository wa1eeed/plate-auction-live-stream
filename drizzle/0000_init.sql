CREATE TABLE "admins" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"bidder_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text NOT NULL,
	"server_sequence" integer NOT NULL,
	"client_request_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"listing_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"status" text NOT NULL,
	"forfeited_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_admin_id" text,
	"reason" text,
	CONSTRAINT "deposits_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "disbursements" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"order_id" text NOT NULL,
	"order_reference" text NOT NULL,
	"listing_id" text NOT NULL,
	"plate_label" text NOT NULL,
	"beneficiary_id" text NOT NULL,
	"beneficiary_name" text NOT NULL,
	"beneficiary_reference" text NOT NULL,
	"gross_amount" bigint NOT NULL,
	"commission_amount" bigint NOT NULL,
	"vat_amount" bigint NOT NULL,
	"amount" bigint NOT NULL,
	"bank_name" text,
	"bank_iban" text,
	"bank_account_name" text,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"created_by_admin_id" text,
	"paid_at" timestamp with time zone,
	"paid_by_admin_id" text,
	"payment_reference" text,
	"ledger_entry_id" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_admin_id" text,
	"cancel_reason" text,
	CONSTRAINT "disbursements_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"show_on_sale_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"uuid" text NOT NULL,
	"kind" text NOT NULL,
	"order_id" text NOT NULL,
	"listing_id" text NOT NULL,
	"order_reference" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_reference" text NOT NULL,
	"seller_name" text NOT NULL,
	"seller_vat_number" text NOT NULL,
	"seller_cr_number" text NOT NULL,
	"seller_address" text NOT NULL,
	"description" text NOT NULL,
	"net_amount" bigint NOT NULL,
	"vat_rate" integer NOT NULL,
	"vat_amount" bigint NOT NULL,
	"total_amount" bigint NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"previous_hash" text NOT NULL,
	"hash" text NOT NULL,
	"qr" text NOT NULL,
	CONSTRAINT "invoices_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"held_after" bigint NOT NULL,
	"listing_id" text,
	"deposit_id" text,
	"order_id" text,
	"note" text,
	"actor_admin_id" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "ledger_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "listing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"seller_id" text NOT NULL,
	"plate_type" text NOT NULL,
	"plate_format" text NOT NULL,
	"arabic_letters" text NOT NULL,
	"latin_letters" text NOT NULL,
	"plate_numbers" text NOT NULL,
	"emblem" text NOT NULL,
	"custom_emblem_url" text,
	"description" text,
	"sale_type" text NOT NULL,
	"status" text NOT NULL,
	"price" bigint NOT NULL,
	"starting_price" bigint NOT NULL,
	"minimum_increment" bigint NOT NULL,
	"reserve_price" bigint NOT NULL,
	"minimum_offer" bigint NOT NULL,
	"duration_seconds" integer NOT NULL,
	"extension_trigger_seconds" integer NOT NULL,
	"extension_duration_seconds" integer NOT NULL,
	"extension_resets_timer" boolean NOT NULL,
	"allow_custom_bid" boolean NOT NULL,
	"deposit_amount" bigint NOT NULL,
	"payment_window_hours" integer NOT NULL,
	"escrow_transfer_window_hours" integer NOT NULL,
	"escrow_review_window_hours" integer NOT NULL,
	"escrow_dispute_window_hours" integer NOT NULL,
	"escrow_release_undo_window_hours" integer NOT NULL,
	"forfeit_percent" integer NOT NULL,
	"forfeit_undo_window_hours" integer NOT NULL,
	"refund_deposit_on_loss" boolean NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"highest_bid_id" text,
	"sold_to_user_id" text,
	"sold_amount" bigint NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "listings_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"listing_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"message" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"listing_id" text NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"payment_due_at" timestamp with time zone,
	"deposit_id" text,
	"paid_at" timestamp with time zone,
	"escrow_amount" bigint DEFAULT 0 NOT NULL,
	"transfer_due_at" timestamp with time zone,
	"transfer_proof_note" text,
	"transfer_proof_at" timestamp with time zone,
	"confirm_due_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	"dispute_reason" text,
	"disputed_by" text,
	"payout_ledger_entry_id" text,
	"released_at" timestamp with time zone,
	"reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_request_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "orders_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"user_id" text NOT NULL,
	"order_id" text,
	"amount" bigint NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"order_price" bigint,
	"buyer_commission" bigint,
	"buyer_vat" bigint,
	"tap_charge_id" text,
	"tap_mode" text,
	"tap_status" text,
	"transfer_note" text,
	"ledger_entry_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"settled_by_admin_id" text,
	CONSTRAINT "payments_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "platform_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"payment_id" text,
	"type" text NOT NULL,
	"amount" bigint NOT NULL,
	"user_id" text,
	"order_id" text,
	"listing_id" text,
	"deposit_id" text,
	"settled" boolean DEFAULT false NOT NULL,
	"ledger_entry_id" text,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"settled_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"reversal_reason" text,
	CONSTRAINT "platform_entries_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sequences_kind_year_pk" PRIMARY KEY("kind","year")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"push_token" text NOT NULL,
	"web_keys" jsonb,
	"app_version" text,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"phone" text,
	"city" text,
	"avatar_url" text,
	"social" jsonb NOT NULL,
	"handle" text,
	"showcase_uses_handle" boolean DEFAULT false NOT NULL,
	"bank_name" text,
	"bank_iban" text,
	"bank_account_name" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"held" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audits_created_idx" ON "audits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bids_listing_idx" ON "bids" USING btree ("listing_id","server_sequence");--> statement-breakpoint
CREATE INDEX "bids_bidder_idx" ON "bids" USING btree ("bidder_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_request_key" ON "bids" USING btree ("bidder_id","client_request_id");--> statement-breakpoint
CREATE INDEX "deposits_user_idx" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_listing_user_key" ON "deposits" USING btree ("listing_id","user_id");--> statement-breakpoint
CREATE INDEX "disbursements_status_idx" ON "disbursements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ledger_user_idx" ON "ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "listing_events_listing_idx" ON "listing_events" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_seller_idx" ON "listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "listings_status_ends_idx" ON "listings" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "offers_listing_idx" ON "offers" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "offers_buyer_idx" ON "offers" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "orders_buyer_idx" ON "orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "orders_seller_idx" ON "orders" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "orders_listing_idx" ON "orders" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "orders_status_due_idx" ON "orders" USING btree ("status","payment_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_request_key" ON "orders" USING btree ("buyer_id","client_request_id");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_charge_key" ON "payments" USING btree ("tap_charge_id");--> statement-breakpoint
CREATE INDEX "platform_entries_type_idx" ON "platform_entries" USING btree ("type","settled");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_token_key" ON "user_devices" USING btree ("push_token");--> statement-breakpoint
CREATE INDEX "user_devices_user_idx" ON "user_devices" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_reference_key" ON "users" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree ("handle");