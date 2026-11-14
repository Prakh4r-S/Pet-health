-- Every column is added only if it is missing, so this migration can be
-- applied to a database that already received some or all of these
-- columns from `prisma db push`.

-- AlterTable
ALTER TABLE "VetProfile" ADD COLUMN IF NOT EXISTS "qualifications" TEXT;

