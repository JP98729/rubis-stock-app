-- CreateTable
CREATE TABLE "CourierDispatch" (
    "id" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "orderRef" TEXT NOT NULL,
    "itemsSummary" TEXT NOT NULL,
    "odooSaleOrderId" INTEGER,
    "odooSaleOrderName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acceptedAt" TIMESTAMP(3),
    "deliveryNoteUrl" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourierDispatch_storeId_idx" ON "CourierDispatch"("storeId");

-- AddForeignKey
ALTER TABLE "CourierDispatch" ADD CONSTRAINT "CourierDispatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
