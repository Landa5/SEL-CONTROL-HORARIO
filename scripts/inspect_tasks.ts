
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tasks = await prisma.tarea.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            creadoPor: { select: { nombre: true } },
            camion: { select: { matricula: true } }
        }
    });

    console.log('--- ÚLTIMAS 50 TAREAS ---');
    tasks.forEach(t => {
        console.log(`[${t.id}] ${t.tipo} - ${t.titulo} (${t.estado})`);
        if (t.matricula || t.camion) console.log(`   Vehículo: ${t.matricula || t.camion?.matricula}`);
        console.log(`   Desc: ${t.descripcion?.substring(0, 50)}...`);
        console.log('---');
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
