
const { PrismaClient } = require('@prisma/client');

async function checkConnection(password) {
    const connectionString = `postgresql://postgres.lwapyfqggmqdavdwqdtn:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    console.log(`Testing with password: ${password.substring(0, 3)}...`);

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: connectionString
            }
        },
        log: ['query', 'info', 'warn', 'error'],
    });

    try {
        await prisma.$connect();
        console.log('Successfully connected to database!');
        const userCount = await prisma.empleado.count();
        console.log(`Connection valid. Found ${userCount} employees.`);
        await prisma.$disconnect();
        return true;
    } catch (e) {
        console.error('Connection failed:', e.message);
        await prisma.$disconnect();
        return false;
    }
}

async function main() {
    console.log('Checking database connection...');

    // Try original password first (Mixed case)
    const success1 = await checkConnection('Sel962650400');
    if (success1) {
        console.log('Password "Sel962650400" is correct.');
        return;
    }

    // Try uppercase password (as seen in .env)
    const success2 = await checkConnection('SEL962650400');
    if (success2) {
        console.log('Password "SEL962650400" is correct.');
        return;
    }

    console.log('Both passwords failed.');
}

main();
