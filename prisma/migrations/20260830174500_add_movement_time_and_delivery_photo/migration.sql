-- Add time-of-day and a delivery note photo upload to a movement
ALTER TABLE "Movement"
  ADD COLUMN "time" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deliveryNotePhotoUrl" TEXT;
