-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('DELIVERY', 'SALE', 'RETURN', 'EXPIRED_DAMAGED');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ALL', 'COUNTY', 'TYPE', 'STORE');

-- CreateEnum
CREATE TYPE "RoleCodeType" AS ENUM ('MERCHANDISER', 'MANAGER', 'HQ');

-- CreateTable
CREATE TABLE "Store" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "seedPhone" TEXT NOT NULL DEFAULT '',
    "seedEmail" TEXT NOT NULL DEFAULT '',
    "codeHash" TEXT NOT NULL,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "managerPhotoUrl" TEXT,
    "managerName" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "sku" TEXT NOT NULL,
    "barcode" TEXT NOT NULL DEFAULT '',
    "range" TEXT NOT NULL,
    "flavour" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "target" INTEGER NOT NULL,
    "unavailable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "Merchandiser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchandiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleCode" (
    "type" "RoleCodeType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleCode_pkey" PRIMARY KEY ("type")
);

-- CreateTable
CREATE TABLE "Stocktake" (
    "id" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "merchandiser" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL DEFAULT '',
    "signatureUrl" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "checksPlacement" TEXT,
    "checksPrices" TEXT,
    "checksMissing" TEXT,
    "checksPromotion" TEXT,
    "checksNotes" TEXT NOT NULL DEFAULT '',
    "placementPhotoUrl" TEXT,
    "pricesPhotoUrl" TEXT,
    "promotionType" TEXT NOT NULL DEFAULT '',
    "promotionPhotoUrl" TEXT,
    "competitorBrands" TEXT NOT NULL DEFAULT '',
    "competitorPhotoUrl" TEXT,
    "photoTaken" BOOLEAN NOT NULL DEFAULT false,
    "embedded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stocktake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StocktakeItem" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "shelfQty" INTEGER NOT NULL DEFAULT 0,
    "backStock" INTEGER NOT NULL DEFAULT 0,
    "expired" INTEGER NOT NULL DEFAULT 0,
    "damaged" INTEGER NOT NULL DEFAULT 0,
    "batchCode" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,

    CONSTRAINT "StocktakeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "qty" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "Audience" NOT NULL,
    "county" TEXT,
    "storeType" TEXT,
    "storeId" INTEGER,
    "from" TEXT NOT NULL DEFAULT 'Rubis Head Office',
    "autoReminder" BOOLEAN NOT NULL DEFAULT false,
    "reminderMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyReward" (
    "monthKey" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MonthlyReward_pkey" PRIMARY KEY ("monthKey")
);

-- CreateIndex
CREATE INDEX "Store_county_idx" ON "Store"("county");

-- CreateIndex
CREATE UNIQUE INDEX "Merchandiser_codeHash_key" ON "Merchandiser"("codeHash");

-- CreateIndex
CREATE INDEX "Stocktake_storeId_date_idx" ON "Stocktake"("storeId", "date");

-- CreateIndex
CREATE INDEX "StocktakeItem_stocktakeId_idx" ON "StocktakeItem"("stocktakeId");

-- CreateIndex
CREATE INDEX "Movement_storeId_date_idx" ON "Movement"("storeId", "date");

-- CreateIndex
CREATE INDEX "Movement_type_date_idx" ON "Movement"("type", "date");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- AddForeignKey
ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeItem" ADD CONSTRAINT "StocktakeItem_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StocktakeItem" ADD CONSTRAINT "StocktakeItem_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

