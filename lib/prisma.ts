// Prisma Client singleton for Hot Module Replacement in Development
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['query'],
    });

// Refreshed client for payroll module

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
