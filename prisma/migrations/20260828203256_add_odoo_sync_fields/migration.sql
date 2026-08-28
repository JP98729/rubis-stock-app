-- AlterTable
ALTER TABLE "Store" ADD COLUMN "odooPartnerId" INTEGER;

-- AlterTable
ALTER TABLE "LpoDocument" ADD COLUMN "odooSaleOrderId" INTEGER;
ALTER TABLE "LpoDocument" ADD COLUMN "odooSaleOrderName" TEXT;
