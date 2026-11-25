ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "views_count" integer DEFAULT 0 NOT NULL;
