
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking PerfilProfesional table...');
        const count = await prisma.perfilProfesional.count();
        console.log(`Table exists. Count: ${count}`);
    } catch (e) {
        console.error('ERROR accessing PerfilProfesional:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
