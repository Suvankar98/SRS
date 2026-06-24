require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: { username: true, password: true, role: true },
    orderBy: { username: 'asc' },
  });

  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
