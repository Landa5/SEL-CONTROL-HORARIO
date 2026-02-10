
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.empleado.count();
        console.log(`Total Empleados: ${count}`);

        const first = await prisma.empleado.findFirst();
        console.log('First Empleado:', first);

        const profiles = await prisma.perfilProfesional.count();
        console.log(`Total Perfiles: ${profiles}`);

    } catch (e) {
        console.error('Error querying DB:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
