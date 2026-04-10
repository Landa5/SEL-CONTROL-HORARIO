
const { PrismaClient } = require('@prisma/client');

async function checkConnection() {
    // SEGURIDAD: Usar variables de entorno, NUNCA hardcodear credenciales
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('ERROR: DATABASE_URL no está definida. Configúrala en .env');
        process.exit(1);
    }
    console.log(`Testing with: ${connectionString.replace(/:[^:]*@/, ':****@')}`);

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
    const success = await checkConnection();
    if (!success) {
        console.log('Connection failed. Check your DATABASE_URL in .env');
    }
}

main();
