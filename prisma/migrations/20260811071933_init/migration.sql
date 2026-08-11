-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Species" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "careNotes" TEXT,

    CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "careNotes" TEXT,
    "adultWeightMinKg" DECIMAL(6,2),
    "adultWeightMaxKg" DECIMAL(6,2),
    "typicalLifespanYears" INTEGER,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaccineType" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "defaultIntervalMonths" INTEGER,

    CONSTRAINT "VaccineType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "breedFreeText" TEXT,
    "name" TEXT NOT NULL,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "birthDate" DATE,
    "birthDateIsApprox" BOOLEAN NOT NULL DEFAULT false,
    "neutered" BOOLEAN,
    "microchipNumber" TEXT,
    "photoUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightLog" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "weightKg" DECIMAL(6,3) NOT NULL,
    "measuredAt" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vaccineTypeId" TEXT NOT NULL,
    "administeredOn" DATE NOT NULL,
    "nextDueOn" DATE,
    "administeredBy" TEXT,
    "batchNumber" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "reaction" TEXT,
    "severity" "Severity" NOT NULL DEFAULT 'UNKNOWN',
    "diagnosedOn" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalCondition" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "diagnosedOn" DATE,
    "resolvedOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Species_name_key" ON "Species"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Species_slug_key" ON "Species"("slug");

-- CreateIndex
CREATE INDEX "Breed_speciesId_idx" ON "Breed"("speciesId");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_speciesId_slug_key" ON "Breed"("speciesId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "VaccineType_speciesId_slug_key" ON "VaccineType"("speciesId", "slug");

-- CreateIndex
CREATE INDEX "Pet_ownerId_archivedAt_idx" ON "Pet"("ownerId", "archivedAt");

-- CreateIndex
CREATE INDEX "WeightLog_petId_measuredAt_idx" ON "WeightLog"("petId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_petId_measuredAt_key" ON "WeightLog"("petId", "measuredAt");

-- CreateIndex
CREATE INDEX "Vaccination_petId_administeredOn_idx" ON "Vaccination"("petId", "administeredOn");

-- CreateIndex
CREATE INDEX "Vaccination_nextDueOn_idx" ON "Vaccination"("nextDueOn");

-- CreateIndex
CREATE INDEX "Allergy_petId_active_idx" ON "Allergy"("petId", "active");

-- CreateIndex
CREATE INDEX "MedicalCondition_petId_resolvedOn_idx" ON "MedicalCondition"("petId", "resolvedOn");

-- AddForeignKey
ALTER TABLE "Breed" ADD CONSTRAINT "Breed_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaccineType" ADD CONSTRAINT "VaccineType_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "Breed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_vaccineTypeId_fkey" FOREIGN KEY ("vaccineTypeId") REFERENCES "VaccineType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCondition" ADD CONSTRAINT "MedicalCondition_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
