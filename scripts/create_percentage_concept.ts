
import { prisma } from '@/lib/prisma';

async function main() {
    // Create Concept 'PORCENTAJE_PRODUCTIVIDAD'
    // Value should be 0-100.
    const concept = await prisma.conceptoNomina.upsert({
        where: { codigo: 'PORCENTAJE_PRODUCTIVIDAD' },
        update: {},
        create: {
            codigo: 'PORCENTAJE_PRODUCTIVIDAD',
            nombre: '% Productividad (sobre resto)',

            descripcion: 'Porcentaje del resto (tras dietas) asignado a Productividad. El resto va a Disponibilidad.'
        }
    });

    console.log(`Concept Updated: ${concept.codigo}`);

    // Set default global tariff to 50%
    await prisma.tarifaNomina.create({
        data: {
            conceptoId: concept.id,
            valor: 50.0,
            activo: true
        }
    });

    console.log('Created default tariff: 50% for PORCENTAJE_PRODUCTIVIDAD');
}

main();
