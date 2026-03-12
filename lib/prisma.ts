// Prisma Client singleton for Hot Module Replacement in Development
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Main client uses DATABASE_URL (pooler, port 6543) - handles connection pooling efficiently
export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Helper for write operations that may fail through the pooler (read-only replica routing)
// Creates a temporary PrismaClient using DIRECT_URL (session mode, port 5432)
export async function withWriteClient<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    // No DIRECT_URL available, try with the main client
    return fn(prisma);
  }
  const writeClient = new PrismaClient({
    datasources: { db: { url: directUrl } },
  });
  try {
    return await fn(writeClient);
  } finally {
    await writeClient.$disconnect();
  }
}
