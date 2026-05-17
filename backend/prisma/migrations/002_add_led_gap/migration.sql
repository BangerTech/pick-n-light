-- Add led_gap column for optional spacing between slots
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "led_gap" INTEGER NOT NULL DEFAULT 0;
