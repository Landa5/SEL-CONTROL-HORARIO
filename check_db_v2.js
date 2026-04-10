
const { PrismaClient } = require('@prisma/client');

async function main() {
    // SEGURIDAD: Usar variables de entorno, NUNCA hardcodear credenciales
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('ERROR: DATABASE_URL no está definida. Configúrala en .env');
        process.exit(1);
    }
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
