const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsApproval" TEXT NOT NULL DEFAULT 'pending'`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsReviewedAt" TIMESTAMP(3)`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "ServiceAssignment" ADD COLUMN IF NOT EXISTS "statusPointsReviewedByName" TEXT`);
  await prisma.$executeRawUnsafe(`UPDATE "ServiceAssignment" SET "statusPointsApproval" = 'approved' WHERE "statusPointsDelta" IS NOT NULL AND "statusPointsApproval" = 'pending'`);
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