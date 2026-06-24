import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim();
}

function shouldUseDatabase() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return false;
  }

  return !/(HOST|USER|PASSWORD|DBNAME)/i.test(databaseUrl);
}

function createPrismaClient() {
  if (!shouldUseDatabase()) {
    console.warn(
      "DATABASE_URL is not configured with a real PostgreSQL connection string. Prisma queries will be disabled until it is set."
    );

    return new Proxy({} as PrismaClient, {
      get() {
        throw new Error("Database is not configured. Set DATABASE_URL to a valid PostgreSQL connection string.");
      },
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}