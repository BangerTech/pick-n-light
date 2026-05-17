-- LEDs at the very start of the strip that belong to no slot (e.g. lead wires before the first compartment)
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "led_skip_first" INTEGER NOT NULL DEFAULT 0;
-- Override LED count for the bottom large row (0 = use the same width as a normal row)
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "large_row_leds" INTEGER NOT NULL DEFAULT 0;
