import { prisma } from '../lib/prisma';

async function main() {
    const shifts = await prisma.jornadaLaboral.findMany({
        where: {
            empleadoId: 7, // Oscar's ID from previous check
            horaSalida: null
        },
        orderBy: { fecha: 'desc' }
    });

    console.log("Open Shifts for Oscar (ID 7):", JSON.stringify(shifts, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
