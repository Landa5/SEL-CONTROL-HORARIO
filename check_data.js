
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ausencias = await prisma.ausencia.findMany();
    const tareas = await prisma.tarea.findMany();

    console.log('Total Ausencias:', ausencias.length);
    console.log('Total Tareas:', tareas.length);

    if (ausencias.length > 0) console.log('Sample Ausencia:', ausencias[0]);
    if (tareas.length > 0) console.log('Sample Tarea:', tareas[0]);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
