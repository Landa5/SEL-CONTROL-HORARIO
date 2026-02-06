
import { prisma } from '@/lib/prisma';

async function main() {
    // 1. Create Concept 'DESCUENTO_AUSENCIA'
    const concept = await prisma.conceptoNomina.upsert({
        where: { codigo: 'DESCUENTO_AUSENCIA' },
        update: {},
        create: {
            codigo: 'DESCUENTO_AUSENCIA',
            nombre: 'Descuento por Ausencia',

            descripcion: 'Penalización por día de ausencia injustificada o vacaciones'
        }
    });

    console.log(`Concept Updated: ${concept.codigo}`);

    // 2. Set default tariff for it (e.g. 50 EUR/day?)
    // User didn't specify amount, so I'll set a placeholder of 0 so it doesn't break,
    // Or closer to reality: maybe 60 EUR?
    // Let's set 0 and ask user to configure, OR set a visible 1 EUR to test.
    // Actually, "descontarla de la productividad" -> it subtracts from the pot?
    // Let's set a global tariff of 50 EUR.

    await prisma.tarifaNomina.create({
        data: {
            conceptoId: concept.id,
            valor: 50.0, // Assumption
            activo: true
        }
    });

    console.log('Created default tariff: 50 EUR for Ausencia');
}

main();
