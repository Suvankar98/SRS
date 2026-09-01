const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DashboardImage" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "imageData" TEXT NOT NULL,
      "uploadedById" UUID,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Dashboard image table is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });