require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, name: true, password: true } });
    console.log('users:', JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('error listing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
