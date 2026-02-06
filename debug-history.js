const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const jornadasCount = await prisma.jornadaLaboral.count();
        console.log(`Total jornadas: ${jornadasCount}`);

        if (jornadasCount > 0) {
            const lastJornadas = await prisma.jornadaLaboral.findMany({
                take: 5,
                orderBy: { fecha: 'desc' },
                include: { empleado: { select: { nombre: true, rol: true } } }
            });
            console.log('--- ÚLTIMOS DÍAS ---');
            console.log(JSON.stringify(lastJornadas, null, 2));
        }

        const users = await prisma.empleado.findMany({
            select: { id: true, nombre: true, rol: true, activo: true }
        });
        console.log('--- USUARIOS ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
