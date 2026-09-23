CREATE TABLE "banners" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"image_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"link_url" text,
	"published" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"media_key" text NOT NULL,
	"media_kind" text NOT NULL,
	"poster_key" text,
	"alt" text DEFAULT '' NOT NULL,
	"link_url" text,
	"duration_seconds" integer DEFAULT 6 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "banners_live_idx" ON "banners" USING btree ("published","sort_order");--> statement-breakpoint
CREATE INDEX "stories_live_idx" ON "stories" USING btree ("published","sort_order");