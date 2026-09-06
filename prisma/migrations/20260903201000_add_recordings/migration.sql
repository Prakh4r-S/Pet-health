-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'FAILED');

-- CreateTable
CREATE TABLE "ConsultationRecording" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "status" "RecordingStatus" NOT NULL DEFAULT 'UPLOADED',
    "transcript" TEXT,
    "segments" JSONB,
    "extraction" JSONB,
    "error" TEXT,
    "transcribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRecording_appointmentId_key" ON "ConsultationRecording"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRecording_pathname_key" ON "ConsultationRecording"("pathname");

-- CreateIndex
CREATE INDEX "ConsultationRecording_status_idx" ON "ConsultationRecording"("status");

-- AddForeignKey
ALTER TABLE "ConsultationRecording" ADD CONSTRAINT "ConsultationRecording_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
