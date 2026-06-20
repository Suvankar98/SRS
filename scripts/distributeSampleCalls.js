const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (employees.length === 0) {
    throw new Error("No employee users found.");
  }

  const requests = await prisma.serviceRequest.findMany({ orderBy: { id: "asc" } });

  for (let index = 0; index < requests.length; index += 1) {
    const employee = employees[index % employees.length];

    await prisma.serviceRequest.update({
      where: { id: requests[index].id },
      data: { assignedToId: employee.id },
    });
  }

  console.log(`Distributed ${requests.length} service requests across ${employees.length} employees.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
