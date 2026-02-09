
const { PrismaClient } = require('@prisma/client');

async function testConnection(connectionString, label) {
    const maskedString = connectionString.replace(/:[^:]*@/, ':****@');
    console.log(`\nTesting: ${label}`);
    console.log(`URL: ${maskedString}`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: connectionString
            }
        },
        log: ['error'], // Only log errors to keep output clean
    });

    try {
        await prisma.$connect();
        const count = await prisma.empleado.count();
        console.log(`SUCCESS! Found ${count} employees.`);
        await prisma.$disconnect();
        return true;
    } catch (e) {
        console.log(`FAILED: ${e.message.split('\n').pop()}`); // Show last line of error
        await prisma.$disconnect();
        return false;
    }
}

async function main() {
    const projectRef = 'lwapyfqggmqdavdwqdtn';
    const password = 'Sel962650400';

    // 1. Direct Connection (IPv6 mostly, might fail on local)
    /* await testConnection(
        `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
        "Direct Connection (Standard)"
    );*/

    // 2. Pooler (Standard AWS alias) - FAILED BEFORE
    await testConnection(
        `postgres://postgres.${projectRef}:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
        "Pooler (AWS Alias)"
    );

    // 3. Pooler (Project Alias - Newer format)
    await testConnection(
        `postgres://postgres.${projectRef}:${password}@${projectRef}.pooler.supabase.com:6543/postgres?pgbouncer=true`,
        "Pooler (Project Alias)"
    );

    // 4. Pooler (Username without project ref? - Rare but testing)
    await testConnection(
        `postgres://postgres:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
        "Pooler (Username 'postgres')"
    );

    // 5. Pooler (Username 'postgres' with Project Alias)
    await testConnection(
        `postgres://postgres:${password}@${projectRef}.pooler.supabase.com:6543/postgres?pgbouncer=true`,
        "Pooler (Username 'postgres' + Project Alias)"
    );
}

main();
