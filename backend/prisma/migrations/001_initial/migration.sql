CREATE TABLE "magazines" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "leds_per_slot" INTEGER NOT NULL DEFAULT 3,
    "bottom_row_large" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "magazines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "slots" (
    "id" SERIAL NOT NULL,
    "magazine_id" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "led_start" INTEGER NOT NULL,
    "led_count" INTEGER NOT NULL,
    "is_large" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "min_quantity" DOUBLE PRECISION,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wled_devices" (
    "id" SERIAL NOT NULL,
    "magazine_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ip_address" TEXT,
    "mqtt_topic" TEXT NOT NULL,
    "led_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wled_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "slots_magazine_id_row_col_key" ON "slots"("magazine_id", "row", "col");
CREATE UNIQUE INDEX "parts_slot_id_key" ON "parts"("slot_id");
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

ALTER TABLE "slots" ADD CONSTRAINT "slots_magazine_id_fkey" FOREIGN KEY ("magazine_id") REFERENCES "magazines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parts" ADD CONSTRAINT "parts_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wled_devices" ADD CONSTRAINT "wled_devices_magazine_id_fkey" FOREIGN KEY ("magazine_id") REFERENCES "magazines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
