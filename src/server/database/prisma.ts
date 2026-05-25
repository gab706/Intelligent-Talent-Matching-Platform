// @ts-ignore
import { PrismaClient } from '../../../../prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is required');
}

const adapter = new PrismaPg({
    connectionString: process.env.POSTGRES_URL
});

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: ['error']
    });

if (process.env.ENVIRONMENT !== 'production') {
    globalForPrisma.prisma = prisma;
}