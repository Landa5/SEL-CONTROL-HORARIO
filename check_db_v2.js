
const { PrismaClient } = require('@prisma/client');

async function main() {
    const connectionString = "postgres://postgres.lwapyfqggmqdavdwqdtn:Sel962650400@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    console.log(`Connecting to: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: connectionString
            }
        },
    });

    try {
        await prisma.$connect();
        console.log('Successfully connected to database!');
        const count = await prisma.empleado.count();
        console.log(`Found ${count} employees.`);
    } catch (e) {
        console.error('Connection failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
