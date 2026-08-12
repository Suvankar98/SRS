const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ALTER COLUMN "performancePoints" TYPE DOUBLE PRECISION USING "performancePoints"::double precision');
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ALTER COLUMN "monthlyPerformancePoints" TYPE DOUBLE PRECISION USING "monthlyPerformancePoints"::double precision');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ALTER COLUMN "statusPointsDelta" TYPE DOUBLE PRECISION USING "statusPointsDelta"::double precision');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceAssignment" ALTER COLUMN "statusPointsDelta" TYPE DOUBLE PRECISION USING "statusPointsDelta"::double precision');
  await prisma.$executeRawUnsafe('ALTER TABLE "EmployeePointAdjustment" ALTER COLUMN "totalDelta" TYPE DOUBLE PRECISION USING "totalDelta"::double precision');
  await prisma.$executeRawUnsafe('ALTER TABLE "MonthlyPerformanceHistory" ALTER COLUMN "totalPoints" TYPE DOUBLE PRECISION USING "totalPoints"::double precision');
  console.log("Point columns support decimal values.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });