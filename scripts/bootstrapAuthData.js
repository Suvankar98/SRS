const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const productNames = [
  "Boom barrier",
  "Sliding gate",
  "Sensor door",
  "Speed breaker",
  "Convex mirror",
  "Metal Detector",
  "Cctv",
  "Intercom",
];

const callTypeNames = [
  "Inquiry",
  "Complaint",
  "Service Visit",
  "Installation",
  "Follow-up",
  "Other",
];

async function upsertUser({ name, username, password, role }) {
  return prisma.user.upsert({
    where: { username },
    update: { name, password, role },
    create: { name, username, password, role },
  });
}

async function main() {
  await Promise.all(
    productNames.map((name) =>
      prisma.product.upsert({
        where: { name },
        update: { name },
        create: { name },
      })
    )
  );

  await Promise.all(
    callTypeNames.map((name) =>
      prisma.callType.upsert({
        where: { name },
        update: { name },
        create: { name },
      })
    )
  );

  await upsertUser({
    name: "System Admin",
    username: "admin",
    password: "admin123",
    role: "ADMIN",
  });

  await upsertUser({
    name: "Operations Manager",
    username: "manager",
    password: "manager123",
    role: "MANAGER",
  });

  await upsertUser({
    name: "Service Employee 1",
    username: "employee1",
    password: "employee123",
    role: "EMPLOYEE",
  });

  await upsertUser({
    name: "Service Employee 2",
    username: "employee2",
    password: "employee123",
    role: "EMPLOYEE",
  });

  await upsertUser({
    name: "Service Employee 3",
    username: "employee3",
    password: "employee123",
    role: "EMPLOYEE",
  });

  console.log("Bootstrapped users, products, and call types.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
