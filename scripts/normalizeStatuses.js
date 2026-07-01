const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CANONICAL_STATUSES = ["New Call", "In Process", "Completed", "Cancel"];

function normalizeStatus(status) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";

  if (normalized === "" || normalized === "new call" || normalized === "pending" || normalized === "new") {
    return "New Call";
  }

  if (
    normalized === "in process" ||
    normalized === "in-process" ||
    normalized === "visit & reschedule" ||
    normalized === "visit and reschedule" ||
    normalized === "reschedule"
  ) {
    return "In Process";
  }

  if (normalized === "completed" || normalized === "close" || normalized === "closed") {
    return "Completed";
  }

  if (normalized === "cancel" || normalized === "cancelled" || normalized === "canceled") {
    return "Cancel";
  }

  return status;
}

async function getStatusCounts() {
  return prisma.serviceRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
    orderBy: { _count: { status: "desc" } },
  });
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  if (counts.length === 0) {
    console.log("  No service requests found.");
    return;
  }

  for (const row of counts) {
    const label = row.status === null ? "<NULL>" : row.status;
    console.log(`  ${label}: ${row._count._all}`);
  }
}

async function main() {
  const shouldApply = process.argv.includes("--apply");

  const beforeCounts = await getStatusCounts();
  printCounts("Status distribution before cleanup:", beforeCounts);

  const rows = await prisma.serviceRequest.findMany({
    select: { id: true, status: true },
  });

  const updates = rows
    .map((row) => {
      const nextStatus = normalizeStatus(row.status);
      return {
        id: row.id,
        from: row.status,
        to: nextStatus,
      };
    })
    .filter((change) => change.from !== change.to);

  if (updates.length === 0) {
    console.log("\nNo legacy statuses found. Database is already normalized.");
    return;
  }

  console.log(`\nFound ${updates.length} record(s) that need status normalization.`);

  if (!shouldApply) {
    console.log("Dry run only. No changes were written.");
    console.log("Run with --apply to persist changes:");
    console.log("  node scripts/normalizeStatuses.js --apply");
    return;
  }

  await prisma.$transaction(
    updates.map((change) =>
      prisma.serviceRequest.update({
        where: { id: change.id },
        data: { status: change.to },
      }),
    ),
  );

  console.log(`Updated ${updates.length} record(s).`);

  const afterCounts = await getStatusCounts();
  printCounts("Status distribution after cleanup:", afterCounts);

  const unknownStatuses = afterCounts
    .map((row) => row.status)
    .filter((status) => status !== null && !CANONICAL_STATUSES.includes(status));

  if (unknownStatuses.length > 0) {
    console.log("\nWarning: Found statuses still outside canonical set:");
    for (const status of unknownStatuses) {
      console.log(`  ${status}`);
    }
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
