
import { prisma } from '@/lib/prisma';

async function main() {
    const concepts = await prisma.conceptoNomina.findMany({
        orderBy: { nombre: 'asc' } // readable order
    });
    console.log('--- CONCEPTOS EXISTENTES ---');
    concepts.forEach(c => console.log(`[${c.active ? 'ACTIVO' : 'INACTIVO'}] ${c.codigo} - ${c.nombre}`));
    console.log('--- FIN ---');
}

main();
