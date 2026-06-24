require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { username: 'admin' } });
    console.log('admin user:', user ? JSON.stringify(user, null, 2) : 'not found');
  } catch (error) {
    console.error('error querying admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
