-- Add a required-by-the-app signature to a movement log
ALTER TABLE "Movement" ADD COLUMN "signatureUrl" TEXT NOT NULL DEFAULT '';
