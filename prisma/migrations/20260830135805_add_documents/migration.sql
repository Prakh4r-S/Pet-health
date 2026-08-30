-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('LAB_REPORT', 'PRESCRIPTION', 'IMAGING', 'VACCINATION_CERT', 'CONSULTATION_SNAPSHOT', 'OTHER');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "appointmentId" TEXT,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "note" TEXT,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_pathname_key" ON "Document"("pathname");

-- CreateIndex
CREATE INDEX "Document_petId_createdAt_idx" ON "Document"("petId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_appointmentId_idx" ON "Document"("appointmentId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
