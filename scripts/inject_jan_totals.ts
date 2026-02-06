
import { prisma } from '@/lib/prisma';

async function main() {
    const data = [
        { name: 'Luis Molina', km: 834, desc: 10, viajes: 2, note: 'Manual Injection.', ausenciaDays: 1 },
        { name: 'Ruben Perez', km: 4298, desc: 227, viajes: 4, note: 'Manual Injection' },
        { name: 'Juan Jose Redon', km: 5342, desc: 192, viajes: 9, note: 'Manual Injection' },
        { name: 'Pascual Graullera', km: 5104, desc: 221, viajes: 5, note: 'Manual Injection' }
    ];

    const year = 2026;
    const month = 1; // January
    const date = new Date(year, month - 1, 31, 12, 0, 0); // Jan 31st

    console.log(`Injecting data for ${date.toISOString()}...`);

    for (const d of data) {
        // Find Employee
        // Split name to matching first/last loosely
        const parts = d.name.split(' ');
        const employees = await prisma.empleado.findMany({
            where: {
                AND: parts.map(p => ({
                    OR: [
                        { nombre: { contains: p } },
                        { apellidos: { contains: p } }
                    ]
                }))
            }
        });

        if (employees.length === 0) {
            console.error(`ERROR: Could not find employee matching '${d.name}'`);
            continue;
        }

        // Pick the first match
        const emp = employees[0];
        console.log(`Processing ${emp.nombre} ${emp.apellidos} (ID: ${emp.id})...`);

        // 1. CLEAR existing January data for this employee to avoid double counting
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Delete Descargas first (FK constraint)
        await prisma.descarga.deleteMany({
            where: {
                usoCamion: {
                    jornada: {
                        empleadoId: emp.id,
                        fecha: { gte: startDate, lte: endDate }
                    }
                }
            }
        });

        // Delete UsosCamion
        await prisma.usoCamion.deleteMany({
            where: {
                jornada: {
                    empleadoId: emp.id,
                    fecha: { gte: startDate, lte: endDate }
                }
            }
        });

        // Delete Jornadas
        await prisma.jornadaLaboral.deleteMany({
            where: {
                empleadoId: emp.id,
                fecha: { gte: startDate, lte: endDate }
            }
        });

        // Delete Absences for this month (Clean slate)
        await prisma.ausencia.deleteMany({
            where: {
                empleadoId: emp.id,
                fechaInicio: { gte: startDate, lte: endDate }
            }
        });

        console.log(`  - Cleared existing Jan data.`);

        // 2. INSERT Summary Data
        // Create 1 Jornada
        const jornada = await prisma.jornadaLaboral.create({
            data: {
                empleadoId: emp.id,
                fecha: date,
                horaEntrada: new Date(year, month - 1, 31, 8, 0),
                horaSalida: new Date(year, month - 1, 31, 18, 0),
                totalHoras: 10,
                estado: 'CERRADA',
                observaciones: 'Total Enero Inyectado'
            }
        });

        // Create 1 UsoCamion
        const camion = await prisma.camion.findFirst();
        if (!camion) {
            console.error('  - No truck found! Skipping details.');
            continue;
        }

        await prisma.usoCamion.create({
            data: {
                jornadaId: jornada.id,
                camionId: camion.id,
                horaInicio: new Date(year, month - 1, 31, 8, 0),
                horaFin: new Date(year, month - 1, 31, 18, 0),
                kmInicial: 0,
                kmFinal: d.km,
                kmRecorridos: d.km,
                descargasCount: d.desc,
                viajesCount: d.viajes,
                notas: d.note
            }
        });

        // Create Absence if needed
        if (d.ausenciaDays && d.ausenciaDays > 0) {
            await prisma.ausencia.create({
                data: {
                    empleadoId: emp.id,
                    tipo: 'AUSENCIA',
                    fechaInicio: new Date(year, month - 1, 5, 9, 0), // Arbitrary date in Jan
                    fechaFin: new Date(year, month - 1, 5 + d.ausenciaDays - 1, 18, 0),
                    estado: 'APROBADA',
                    observaciones: 'Inyección Manual'
                }
            });
            console.log(`  - Created Absence: ${d.ausenciaDays} days`);
        }

        console.log(`  - Injected: ${d.km}km, ${d.desc}desc, ${d.viajes}viajes`);
    }

    console.log('Done!');
}

main()
    .catch(e => {
        console.error('SCRIPT ERROR:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
