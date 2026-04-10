
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
        log: ['error'],
    });

    try {
        await prisma.$connect();
        const count = await prisma.empleado.count();
        console.log(`SUCCESS! Found ${count} employees.`);
        await prisma.$disconnect();
        return true;
    } catch (e) {
        console.log(`FAILED: ${e.message.split('\n').pop()}`);
        await prisma.$disconnect();
        return false;
    }
}

async function main() {
    // SEGURIDAD: Usar variables de entorno, NUNCA hardcodear credenciales
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('ERROR: DATABASE_URL no está definida. Configúrala en .env');
        console.error('Ejemplo: DATABASE_URL=postgres://user:pass@host:port/db');
        process.exit(1);
    }

    await testConnection(connectionString, "DATABASE_URL");
}

main();
