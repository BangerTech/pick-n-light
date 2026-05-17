-- LEDs to skip at BOTH ends of every physical row (e.g. 1 = skip first+last LED of each row)
ALTER TABLE "magazines" ADD COLUMN IF NOT EXISTS "row_padding" INTEGER NOT NULL DEFAULT 0;
