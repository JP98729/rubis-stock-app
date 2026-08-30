-- A Delivery is now logged as paperwork only (no product/quantity), so sku can be null
ALTER TABLE "Movement" ALTER COLUMN "sku" DROP NOT NULL;
