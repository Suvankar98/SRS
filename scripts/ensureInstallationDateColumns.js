const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "SavedCustomer" ADD COLUMN IF NOT EXISTS "installationDate" TIMESTAMP(3)');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "installationDate" TIMESTAMP(3)');
  console.log("Installation date columns are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
