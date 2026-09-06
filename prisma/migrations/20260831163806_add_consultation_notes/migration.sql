-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'FINALISED');

-- CreateTable
CREATE TABLE "ConsultationNote" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "vetProfileId" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "scratch" TEXT,
    "presentingComplaint" TEXT,
    "examination" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "followUpOn" DATE,
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteAmendment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "drug" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationNote_appointmentId_key" ON "ConsultationNote"("appointmentId");

-- CreateIndex
CREATE INDEX "ConsultationNote_vetProfileId_createdAt_idx" ON "ConsultationNote"("vetProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteAmendment_noteId_createdAt_idx" ON "NoteAmendment"("noteId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_petId_createdAt_idx" ON "Prescription"("petId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationNote" ADD CONSTRAINT "ConsultationNote_vetProfileId_fkey" FOREIGN KEY ("vetProfileId") REFERENCES "VetProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAmendment" ADD CONSTRAINT "NoteAmendment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ConsultationNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteAmendment" ADD CONSTRAINT "NoteAmendment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "ConsultationNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
