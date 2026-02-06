import { PrismaClient } from '@prisma/client';
// @ts-ignore
// @ts-ignore
import { PrismaClient as PrismaClientSqlite } from '../prisma-client-sqlite';

const prismaPg = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:Sel962650400@db.lwapyfqggmqdavdwqdtn.supabase.co:5432/postgres" // explicit url to be safe
        }
    }
});
const prismaSqlite = new PrismaClientSqlite();

async function main() {
    console.log('🔍 Testing SQLite connection...');
    try {
        const count = await prismaSqlite.empleado.count();
        console.log(`✅ SQLite Empleado count: ${count}`);
    } catch (e) {
        console.error('❌ SQLite failed:', e);
    }

    console.log('🔍 Testing Postgres connection...');
    try {
        // Just check connection
        await prismaPg.$connect();
        console.log('✅ Postgres connected');
        // Count employees (should be 0 or whatever)
        const countPg = await prismaPg.empleado.count();
        console.log(`✅ Postgres Empleado count: ${countPg}`);
    } catch (e) {
        console.error('❌ Postgres failed:', e);
    }
}

main()
    .finally(async () => {
        await prismaPg.$disconnect();
        await prismaSqlite.$disconnect();
    });
