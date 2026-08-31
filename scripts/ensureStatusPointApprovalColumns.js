const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsApproval" TEXT NOT NULL DEFAULT 'pending'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsReviewedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsReviewedByName" TEXT`);
  await prisma.$executeRawUnsafe(`UPDATE "ServiceAssignment" SET "statusPointsApproval" = 'approved' WHERE "statusPointsDelta" IS NOT NULL AND "statusPointsApproval" = 'pending'`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusAssignmentId" UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusAssignedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusAssignedCallCount" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusSubmittedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusPointsDelta" DOUBLE PRECISION`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusPointsApproval" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusPointsReviewedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceRequestActivity" ADD COLUMN IF NOT EXISTS "statusPointsReviewedByName" TEXT`);
  await prisma.$executeRawUnsafe(`
    UPDATE "ServiceRequestActivity" a
    SET
      "statusAssignmentId" = sa."id",
      "statusAssignedAt" = sa."assignedAt",
      "statusSubmittedAt" = COALESCE(a."statusSubmittedAt", sa."statusSubmittedAt", a."createdAt"),
      "statusPointsDelta" = sa."statusPointsDelta",
      "statusPointsApproval" = sa."statusPointsApproval",
      "statusPointsReviewedAt" = sa."statusPointsReviewedAt",
      "statusPointsReviewedByName" = sa."statusPointsReviewedByName"
    FROM "ServiceAssignment" sa
    WHERE a."requestId" = sa."requestId"
      AND a."employeeId" = sa."employeeId"
      AND a."type" IN ('status', 'completed')
      AND sa."statusSubmittedAt" IS NOT NULL
      AND ABS(EXTRACT(EPOCH FROM (COALESCE(a."statusSubmittedAt", a."createdAt") - sa."statusSubmittedAt"))) <= 300
  `);
  await prisma.$executeRawUnsafe(`UPDATE "ServiceRequestActivity" SET "statusSubmittedAt" = "createdAt", "statusPointsApproval" = 'pending' WHERE "statusPointsApproval" IS NULL AND "employeeId" IS NOT NULL AND "type" IN ('status', 'completed')`);
  console.log("Status point approval columns are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });