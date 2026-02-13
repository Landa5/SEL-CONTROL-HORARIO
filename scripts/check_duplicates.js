
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkDuplicates() {
    const logStream = fs.createWriteStream('duplicates_log.txt');
    function log(msg) {
        console.log(msg);
        logStream.write(msg + '\n');
    }

    try {
        log('Searching for trucks with "4563"...');
        const trucks = await prisma.camion.findMany({
            where: {
                matricula: { contains: '4563' }
            },
            include: {
                _count: {
                    select: {
                        usos: true,
                        tareas: true,
                        mantenimientosPlanificados: true,
                        historialMantenimientos: true,
                        documentos: true
                    }
                }
            }
        });

        log(`Found ${trucks.length} trucks:`);
        trucks.forEach(t => {
            log(`ID: ${t.id} | Plate: ${t.matricula} | Active: ${t.activo}`);
            log(`  - Usos (Jornadas): ${t._count.usos}`);
            log(`  - Tareas (Talleres/Incidencias): ${t._count.tareas}`);
            log(`  - Mant. Planificados: ${t._count.mantenimientosPlanificados}`);
            log(`  - Historial Mant.: ${t._count.historialMantenimientos}`);
            log(`  - Documentos: ${t._count.documentos}`);
            log('-----------------------------------');
        });

    } catch (error) {
        log('Error checking duplicates: ' + error);
    } finally {
        await prisma.$disconnect();
        logStream.end();
    }
}

checkDuplicates();
