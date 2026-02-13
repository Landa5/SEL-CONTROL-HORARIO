const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const tareas = await prisma.tarea.findMany({
            take: 10,
            select: {
                id: true,
                titulo: true,
                tipo: true,
                prioridad: true,
                estado: true
            }
        });
        console.log('Existing Tareas:', JSON.stringify(tareas, null, 2));
    } catch (e) {
        console.error('Error querying tareas:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
