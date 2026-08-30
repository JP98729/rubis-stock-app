-- Add the merchandiser's KRA PIN (required for every merchandiser visit)
ALTER TABLE "Stocktake" ADD COLUMN "kraPin" TEXT NOT NULL DEFAULT '';
