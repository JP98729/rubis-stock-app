-- Add the merchandiser's own phone number to a stocktake (optional, for payment purposes)
ALTER TABLE "Stocktake" ADD COLUMN "merchandiserPhone" TEXT NOT NULL DEFAULT '';
