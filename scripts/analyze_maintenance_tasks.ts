
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const keywords = ['averia', 'taller', 'aceite', 'ruedas', 'itv', 'mantenimiento', 'reparacion', 'revisión', 'frenos'];

    const allTasks = await prisma.tarea.findMany({
        include: {
            creadoPor: { select: { nombre: true, apellidos: true } },
            camion: { select: { matricula: true } }
        }
    });

    const maintenanceTasks = allTasks.filter(t => {
        const text = (t.titulo + ' ' + t.descripcion).toLowerCase();
        return keywords.some(k => text.includes(k));
    });

    console.log(`Total Tareas: ${allTasks.length}`);
    console.log(`Posibles Tareas de Taller: ${maintenanceTasks.length}`);
    console.log('--- DETALLE ---');

    const byStatus: Record<string, number> = {};

    maintenanceTasks.forEach(t => {
        byStatus[t.estado] = (byStatus[t.estado] || 0) + 1;
        console.log(`[${t.id}] ${t.estado} | ${t.titulo} | Camión: ${t.camion?.matricula || 'N/A'}`);
    });

    console.log('--- ESTADOS ---');
    console.log(JSON.stringify(byStatus, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
