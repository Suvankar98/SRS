require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const username = 'admin';
  const password = 'admin123';
  const user = await prisma.user.findUnique({ where: { username } });
  console.log('user', user);
  console.log('match', user?.password === password);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
