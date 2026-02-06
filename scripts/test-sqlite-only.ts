// @ts-ignore
import { PrismaClient as PrismaClientSqlite } from '../prisma-client-sqlite';

const prismaSqlite = new PrismaClientSqlite();

async function main() {
    console.log('🔍 Testing SQLite connection ONLY...');
    try {
        const count = await prismaSqlite.empleado.count();
        console.log(`✅ SQLite Empleado count: ${count}`);
    } catch (e) {
        console.error('❌ SQLite failed:', e);
    }
}

main()
    .finally(async () => {
        await prismaSqlite.$disconnect();
    });
