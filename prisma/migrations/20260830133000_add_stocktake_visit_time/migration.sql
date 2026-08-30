-- Add the time-of-day a merchandiser started a stocktake visit
ALTER TABLE "Stocktake" ADD COLUMN "visitTime" TEXT NOT NULL DEFAULT '';
