const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const mecanico = await prisma.empleado.findFirst({
        where: { rol: 'MECANICO', activo: true }
    });
    console.log('Mecanico:', mecanico);
    const allRef = await prisma.empleado.findMany({
        select: { id: true, nombre: true, rol: true, activo: true }
    });
    console.log('All Users:', allRef);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
