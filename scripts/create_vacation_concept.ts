
import { prisma } from '@/lib/prisma';

async function main() {
    // Create Concept 'DESCUENTO_VACACIONES'
    const concept = await prisma.conceptoNomina.upsert({
        where: { codigo: 'DESCUENTO_VACACIONES' },
        update: {},
        create: {
            codigo: 'DESCUENTO_VACACIONES',
            nombre: 'Descuento por Vacaciones',
            tipo: 'DEDUCCION',
            descripcion: 'Penalización por día de vacaciones disfrutadas'
        }
    });

    console.log(`Concept Updated: ${concept.codigo}`);

    // Set default tariff SAME as Absence for now (e.g. 0 or 45), ensuring it exists globally
    await prisma.tarifaNomina.create({
        data: {
            conceptoId: concept.id,
            valor: 45.0, // Default fallback
            activo: true
        }
    });

    console.log('Created default tariff: 45 EUR for Vacaciones');
}

main();
