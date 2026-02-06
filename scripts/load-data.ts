import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Force env var just in case
process.env.DATABASE_URL = "postgresql://postgres:Sel962650400@db.lwapyfqggmqdavdwqdtn.supabase.co:5432/postgres";

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting data import to Supabase...');

    const dataPath = path.join(__dirname, 'data_dump.json');
    if (!fs.existsSync(dataPath)) {
        throw new Error('data_dump.json not found');
    }
    const dataRaw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    // Helper to convert date strings back to Date objects
    const restoreDates = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') {
            // Simple ISO date regex
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
                return new Date(obj);
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(restoreDates);
        }
        if (typeof obj === 'object') {
            const result: any = {};
            for (const key in obj) {
                result[key] = restoreDates(obj[key]);
            }
            return result;
        }
        return obj;
    };

    const data = restoreDates(dataRaw);

    // Order matters for FKs
    const tables = [
        'empleado', 'camion', 'fiestaLocal', 'conceptoNomina',
        'moduloFormacion', // Has FK to Empleado
        'temaFormacion', 'preguntaFormacion', 'resultadoFormacion',
        'tarifaNomina', 'jornadaLaboral',
        'compensacionFestivo', 'usoCamion', 'descarga', 'tarea',
        'tareaHistorial', 'tareaAdjunto', 'mantenimientoRealizado',
        'ausencia', 'mantenimientoProximo', 'auditoria', 'notificacion',
        'nominaMes', 'nominaLinea', 'comercialLitros', 'envioGestoria'
    ];

    for (const table of tables) {
        if (data[table] && data[table].length > 0) {
            console.log(`Importing ${table} (${data[table].length} records)...`);

            // Handle casting for 'rol' in Empleado if needed
            let rows = data[table];
            if (table === 'empleado') {
                rows = rows.map((r: any) => ({
                    ...r,
                    rol: r.rol as any // explicit cast to any for enum
                }));
            }

            try {
                await prisma[table].createMany({ data: rows });
                console.log(`✅ Imported ${table}`);
            } catch (e) {
                console.error(`❌ Failed to import ${table}:`, e);
            }
        }
    }

    console.log('🔄 Resetting Sequences...');
    const tableNamesMap: Record<string, string> = {
        'empleado': 'Empleado', 'camion': 'Camion', 'fiestaLocal': 'FiestaLocal',
        'conceptoNomina': 'ConceptoNomina', 'moduloFormacion': 'ModuloFormacion',
        'temaFormacion': 'TemaFormacion', 'preguntaFormacion': 'PreguntaFormacion',
        'resultadoFormacion': 'ResultadoFormacion', 'tarifaNomina': 'TarifaNomina',
        'jornadaLaboral': 'JornadaLaboral', 'compensacionFestivo': 'CompensacionFestivo',
        'usoCamion': 'UsoCamion', 'descarga': 'Descarga', 'tarea': 'Tarea',
        'tareaHistorial': 'TareaHistorial', 'tareaAdjunto': 'TareaAdjunto',
        'mantenimientoRealizado': 'MantenimientoRealizado', 'ausencia': 'Ausencia',
        'mantenimientoProximo': 'MantenimientoProximo', 'auditoria': 'Auditoria',
        'notificacion': 'Notificacion', 'nominaMes': 'NominaMes',
        'nominaLinea': 'NominaLinea', 'comercialLitros': 'ComercialLitros',
        'envioGestoria': 'EnvioGestoria'
    };

    for (const key of tables) {
        const tableName = tableNamesMap[key];
        try {
            await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${tableName}";`);
            console.log(`  - Reset sequence for ${tableName}`);
        } catch (error) {
            console.error(`  - Failed to reset sequence for ${tableName}`, error);
        }
    }

    console.log('🎉 Import Completed Successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
