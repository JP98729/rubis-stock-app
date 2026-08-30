-- Add delivery note and invoice number to a movement (relevant for type DELIVERY only)
ALTER TABLE "Movement"
  ADD COLUMN "deliveryNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "invoiceNumber" TEXT NOT NULL DEFAULT '';
