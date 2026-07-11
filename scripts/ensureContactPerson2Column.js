const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE "ServiceRequest" ADD COLUMN IF NOT EXISTS "contactPerson2" TEXT');
  console.log("Service request contactPerson2 column is ready.");
})()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
