
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const ausencias = await prisma.ausencia.findMany({
            where: { estado: 'PENDIENTE' },
            select: { id: true, tipo: true, empleado: { select: { nombre: true } } }
        });

        // ABIERTA removed, use valid enums
        const tareas = await prisma.tarea.findMany({
            where: { estado: { in: ['PENDIENTE', 'BACKLOG', 'EN_CURSO'] } },
            select: { id: true, titulo: true, estado: true }
        });

        console.log('--- AUSENCIAS PENDIENTES ---');
        console.log(JSON.stringify(ausencias, null, 2));

        console.log('--- TAREAS PENDIENTES ---');
        console.log(JSON.stringify(tareas, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
