
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const absences = await prisma.ausencia.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { empleado: true }
        });

        console.log("Found absences:", absences.length);
        absences.forEach(abs => {
            console.log(`ID: ${abs.id}, Type: ${abs.tipo}, CreatedAt: ${abs.createdAt}, User: ${abs.empleado.nombre}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
