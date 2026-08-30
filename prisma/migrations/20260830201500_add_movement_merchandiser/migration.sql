-- Add the merchandiser's name (who logged/delivered it) to a movement
ALTER TABLE "Movement" ADD COLUMN "merchandiser" TEXT NOT NULL DEFAULT '';
