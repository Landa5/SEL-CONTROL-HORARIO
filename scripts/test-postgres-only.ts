import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = "postgresql://postgres:Sel962650400@db.lwapyfqggmqdavdwqdtn.supabase.co:5432/postgres";

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Testing Postgres connection ONLY...');
    try {
        await prisma.$connect();
        console.log('✅ Postgres connected');
        const count = await prisma.empleado.count();
        console.log(`✅ Postgres Empleado count: ${count}`);
    } catch (e) {
        console.error('❌ Postgres failed:', e);
    }
}

main()
    .finally(async () => {
        await prisma.$disconnect();
    });
