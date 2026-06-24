const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.serviceRequest.findMany({
    select: { docketNumber: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  for (const row of rows) {
    console.log(row.docketNumber);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
