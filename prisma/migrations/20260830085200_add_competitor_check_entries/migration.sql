-- Add structured 3-brand competitor check fields to Stocktake
ALTER TABLE "Stocktake"
  ADD COLUMN "competitorBrand1" TEXT,
  ADD COLUMN "competitorPrice1" DOUBLE PRECISION,
  ADD COLUMN "competitorPhotoUrl1" TEXT,
  ADD COLUMN "competitorBrand2" TEXT,
  ADD COLUMN "competitorPrice2" DOUBLE PRECISION,
  ADD COLUMN "competitorPhotoUrl2" TEXT,
  ADD COLUMN "competitorBrand3" TEXT,
  ADD COLUMN "competitorPrice3" DOUBLE PRECISION,
  ADD COLUMN "competitorPhotoUrl3" TEXT;
