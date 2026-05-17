-- Strip origin: which corner of the magazine is LED 0 physically located
-- Values: top-left | top-right | bottom-left | bottom-right
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "strip_origin" TEXT NOT NULL DEFAULT 'top-left';
