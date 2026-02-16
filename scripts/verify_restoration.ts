import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const models = [
        'empleado',
        'camion',
        'tarea',
        'tareaHistorial',
        'mantenimientoRealizado',
        'jornadaLaboral',
        'usoCamion'
    ];

    console.log('Verifying table counts...');

    for (const key of models) {
        try {
            const count = await (prisma as any)[key].count();
            console.log(`${key}: ${count}`);
        } catch (e: any) {
            console.log(`${key}: Error counting (${e.message})`);
        }
    }
}

main().finally(() => prisma.$disconnect());
