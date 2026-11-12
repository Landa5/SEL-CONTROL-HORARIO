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

// Singleton write client for direct DB operations (session mode, port 5432)
const globalForWritePrisma = global as unknown as { writePrisma?: PrismaClient };

export const writePrisma =
    globalForWritePrisma.writePrisma ||
    (process.env.DIRECT_URL
        ? new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })
        : prisma);

if (process.env.NODE_ENV !== 'production') globalForWritePrisma.writePrisma = writePrisma;

export async function withWriteClient<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    return fn(writePrisma);
}
