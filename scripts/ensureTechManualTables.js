const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TechManualFolder" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "category" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdById" UUID,
      "createdByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TechManualDocument" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "folderId" UUID NOT NULL,
      "name" TEXT NOT NULL,
      "documentType" TEXT NOT NULL,
      "fileName" TEXT,
      "fileUrl" TEXT,
      "youtubeUrl" TEXT,
      "uploadedById" UUID,
      "uploadedByName" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TechManualDocument_folderId_fkey"
        FOREIGN KEY ("folderId") REFERENCES "TechManualFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TechManualFolder_category_createdAt_idx"
    ON "TechManualFolder" ("category", "createdAt")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "TechManualDocument_folderId_createdAt_idx"
    ON "TechManualDocument" ("folderId", "createdAt")
  `);

  console.log("Tech manual tables are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
