// Prisma Client singleton for Hot Module Replacement in Development
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Use DIRECT_URL to bypass PgBouncer (which may route to read-only replicas)
// Falls back to DATABASE_URL if DIRECT_URL is not set
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
        datasources: {
            db: {
                url: databaseUrl,
            },
        },
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
