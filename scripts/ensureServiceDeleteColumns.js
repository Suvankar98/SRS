const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "deletedById" UUID');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "deletedByName" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "deletedByRole" TEXT');
  console.log("Service delete audit columns are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
