-- Written so it can be applied to a database that already has the table
-- (from `prisma db push`): the table and indexes are created only if
-- missing, and the foreign keys are part of the table definition rather
-- than separate statements that would fail the second time.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FollowUpMessage" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FollowUpMessage_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpMessage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FollowUpMessage_documentId_key" ON "FollowUpMessage"("documentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FollowUpMessage_appointmentId_createdAt_idx" ON "FollowUpMessage"("appointmentId", "createdAt");
