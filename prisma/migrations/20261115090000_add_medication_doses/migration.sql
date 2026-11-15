-- Written so it can be applied to a database that already has the table
-- (from `prisma db push`): the table and index are created only if
-- missing, and the foreign keys are part of the table definition rather
-- than separate statements that would fail the second time.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MedicationDose" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "loggedById" TEXT NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationDose_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MedicationDose_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MedicationDose_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationDose_prescriptionId_givenAt_idx" ON "MedicationDose"("prescriptionId", "givenAt");
