const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking Empleado table columns ---');
        // This is a bit hacky for SQLite but let's try to get one record or describe
        const columns = await prisma.$queryRaw`PRAGMA table_info(Empleado)`;
        console.log(JSON.stringify(columns, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

        console.log('\n--- Checking for FiestaLocal table ---');
        const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type="table" AND name="FiestaLocal"`;
        console.log(JSON.stringify(tables, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
