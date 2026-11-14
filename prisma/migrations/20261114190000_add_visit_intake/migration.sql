-- CreateEnum
CREATE TYPE "SymptomDuration" AS ENUM ('TODAY', 'FEW_DAYS', 'ABOUT_A_WEEK', 'OVER_A_WEEK');

-- CreateEnum
CREATE TYPE "VisitUrgency" AS ENUM ('ROUTINE', 'SOON', 'URGENT');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "intakeNotes" TEXT,
ADD COLUMN     "symptomDuration" "SymptomDuration",
ADD COLUMN     "urgency" "VisitUrgency";

-- AlterTable
ALTER TABLE "ConsultationNote" ADD COLUMN     "followUpNote" TEXT;
