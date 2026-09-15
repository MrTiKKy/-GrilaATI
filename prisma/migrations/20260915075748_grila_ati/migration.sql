-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "nume" TEXT NOT NULL,
    "zileCoRamase" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programare" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "valoare" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Programare_staffId_data_key" ON "Programare"("staffId", "data");

-- AddForeignKey
ALTER TABLE "Programare" ADD CONSTRAINT "Programare_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
