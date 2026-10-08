const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SalarySlip" (
      "id" UUID PRIMARY KEY,
      "employeeId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12),
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileData" BYTEA NOT NULL,
      "uploadedById" UUID,
      "uploadedByName" TEXT,
      "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SalarySlip"
    DROP CONSTRAINT IF EXISTS "SalarySlip_employeeId_year_month_key"
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SalarySlip_employeeId_year_month_idx"
    ON "SalarySlip" ("employeeId", "year", "month")
  `);

  console.log("Salary slip table is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
