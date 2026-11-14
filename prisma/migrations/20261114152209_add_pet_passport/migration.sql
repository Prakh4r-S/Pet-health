-- CreateTable
CREATE TABLE "PetPassport" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "contactNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PetPassport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PetPassport_petId_key" ON "PetPassport"("petId");

-- CreateIndex
CREATE UNIQUE INDEX "PetPassport_token_key" ON "PetPassport"("token");

-- AddForeignKey
ALTER TABLE "PetPassport" ADD CONSTRAINT "PetPassport_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
