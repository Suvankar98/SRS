const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const records = await prisma.serviceRequest.findMany({
    select: { id: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (records.length === 0) {
    console.log("No service requests found. Nothing to normalize.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of records) {
      await tx.serviceRequest.update({
        where: { id: row.id },
        data: { docketNumber: `tmp-${row.id}` },
      });
    }

    for (let index = 0; index < records.length; index += 1) {
      await tx.serviceRequest.update({
        where: { id: records[index].id },
        data: { docketNumber: `srs-${index + 1}` },
      });
    }
  });

  console.log(`Normalized ${records.length} docket numbers to srs-1 ... srs-${records.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
