import { prisma } from '../lib/prisma';
import { calcularNominaEmpleado } from '../lib/nominas/calculos';

async function main() {
    console.log('--- STARTING PAYROLL VERIFICATION ---');

    // 1. Ensure concepts exist
    const concepts = await prisma.conceptoNomina.findMany();
    console.log(`Concepts found: ${concepts.length}`);

    // 2. Find a Conductor to test
    const conductor = await prisma.empleado.findFirst({ where: { rol: 'CONDUCTOR' } });
    if (!conductor) {
        console.log('No conductor found. Skipping Conductor test.');
    } else {
        console.log(`Testing Conductor: ${conductor.nombre} (ID: ${conductor.id})`);

        // Mock Tariffs for test
        await prisma.tarifaNomina.createMany({
            data: [
                { conceptoId: 1, rol: 'CONDUCTOR', valor: 0.10, activo: true }, // KM (assuming ID 1 is KM)
                // Note: ID 1 might not be KM. We should rely on codes.
            ]
        });

        // Ensure accurate lookup by code for test setup
        const cKm = await prisma.conceptoNomina.findUnique({ where: { codigo: 'PRECIO_KM' } });
        if (cKm) {
            await prisma.tarifaNomina.updateMany({ where: { conceptoId: cKm.id }, data: { activo: false } });
            await prisma.tarifaNomina.create({ data: { conceptoId: cKm.id, rol: 'CONDUCTOR', valor: 0.12, activo: true } });
        }

        const lines = await calcularNominaEmpleado(conductor.id, 2024, 1); // Jan 2024
        console.log('Calculated Lines for Conductor:');
        lines.forEach(l => console.log(` - ${l.nombre}: ${l.cantidad} x ${l.rate} = ${l.importe.toFixed(2)}`));
    }

    console.log('--- VERIFICATION COMPLETE ---');
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
