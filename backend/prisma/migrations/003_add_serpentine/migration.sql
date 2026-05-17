-- Add serpentine option: odd rows run right-to-left on the physical LED strip
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "serpentine" BOOLEAN NOT NULL DEFAULT false;
