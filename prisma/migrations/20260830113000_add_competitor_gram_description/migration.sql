-- Add gram/weight and item description fields to each of the 3 competitor entries
ALTER TABLE "Stocktake"
  ADD COLUMN "competitorGram1" TEXT,
  ADD COLUMN "competitorDescription1" TEXT,
  ADD COLUMN "competitorGram2" TEXT,
  ADD COLUMN "competitorDescription2" TEXT,
  ADD COLUMN "competitorGram3" TEXT,
  ADD COLUMN "competitorDescription3" TEXT;
