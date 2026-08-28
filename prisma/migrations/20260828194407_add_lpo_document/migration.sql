-- CreateTable
CREATE TABLE "LpoDocument" (
    "id" TEXT NOT NULL,
    "storeId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LpoDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LpoDocument_storeId_idx" ON "LpoDocument"("storeId");

-- AddForeignKey
ALTER TABLE "LpoDocument" ADD CONSTRAINT "LpoDocument_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
