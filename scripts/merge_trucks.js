
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeTrucks() {
    const sourceId = 5; // 4563LZS (Inactive, has data)
    const targetId = 11; // 4563-LZS (Active, correct format)

    try {
        console.log(`Merging Truck ID ${sourceId} -> ID ${targetId}`);

        // 1. Move UsoCamion (Jornadas)
        const usos = await prisma.usoCamion.updateMany({
            where: { camionId: sourceId },
            data: { camionId: targetId }
        });
        console.log(`Moved ${usos.count} UsoCamion records.`);

        // 2. Move Tareas
        const tareas = await prisma.tarea.updateMany({
            where: { camionId: sourceId },
            data: { camionId: targetId }
        });
        console.log(`Moved ${tareas.count} Tarea records.`);

        // 3. Move MantenimientoProximo
        const mantPlan = await prisma.mantenimientoProximo.updateMany({
            where: { camionId: sourceId },
            data: { camionId: targetId }
        });
        console.log(`Moved ${mantPlan.count} MantenimientoProximo records.`);

        // 4. Move MantenimientoRealizado
        const mantHist = await prisma.mantenimientoRealizado.updateMany({
            where: { camionId: sourceId },
            data: { camionId: targetId }
        });
        console.log(`Moved ${mantHist.count} MantenimientoRealizado records.`);

        // 5. Move Documentos
        const docs = await prisma.documento.updateMany({
            where: { camionId: sourceId },
            data: { camionId: targetId }
        });
        console.log(`Moved ${docs.count} Documento records.`);

        // 6. Delete Source Truck
        await prisma.camion.delete({
            where: { id: sourceId }
        });
        console.log(`Deleted Truck ID ${sourceId} (4563LZS).`);
        console.log('Merge completed successfully.');

    } catch (error) {
        console.error('Error merging trucks:', error);
    } finally {
        await prisma.$disconnect();
    }
}

mergeTrucks();
