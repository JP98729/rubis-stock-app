-- Add the name of the person at the branch who received the delivery
ALTER TABLE "Movement" ADD COLUMN "receivedBy" TEXT NOT NULL DEFAULT '';
