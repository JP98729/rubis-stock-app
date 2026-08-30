-- Add the branch's physical address (self-service, like contactPhone/contactEmail)
ALTER TABLE "Store" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
