const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SavedCustomer" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "company" TEXT NOT NULL,
      "companyKey" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL DEFAULT '',
      "phoneNumber1" TEXT NOT NULL DEFAULT '',
      "area" TEXT NOT NULL DEFAULT '',
      "fullAddress" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SavedCustomer_companyKey_key"
    ON "SavedCustomer" ("companyKey")
  `);

  console.log("SavedCustomer table is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
