import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const DUMP_FILE = path.join(process.cwd(), 'scripts', 'data_dump.json');

async function main() {
    console.log('Starting restoration process...');
    console.log('Reading dump file from:', DUMP_FILE);

    let data: any;
    try {
        const fileContent = fs.readFileSync(DUMP_FILE, 'utf-8');
        data = JSON.parse(fileContent);
    } catch (e) {
        console.error('Failed to read or parse dump file:', e);
        process.exit(1);
    }

    const keys = Object.keys(data);
    console.log('Found keys in dump:', keys);

    // Map JSON keys to Prisma Models
    const modelOrder = [
        'fiestaLocal',
        'conceptoNomina',
        'empleado', // Users/Employees
        'camion',   // Trucks
        'tarifaNomina', // Depends on Concepto, Empleado
        'notificacion', // Depends on Empleado (Usuario)
        'nominaMes', // Depends on Empleado
        'nominaLinea', // Depends on NominaMes
        'ausencia', // Depends on Empleado
        'jornadaLaboral', // Depends on Empleado
        'usoCamion', // Depends on Jornada, Camion
        'descarga', // Depends on UsoCamion
        'tarea', // Depends on Empleado, Camion
        'tareaHistorial', // Depends on Tarea
        'mantenimientoRealizado', // Depends on Camion, Tarea (optional)
    ];

    // Helper to parse dates
    const parseDates = (obj: any) => {
        const newObj = { ...obj };
        for (const key in newObj) {
            if (typeof newObj[key] === 'string') {
                // Simple ISO date check: YYYY-MM-DDTHH:mm:ss.sssZ
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(newObj[key])) {
                    newObj[key] = new Date(newObj[key]);
                }
            }
        }
        return newObj;
    };

    try {
        // 1. Clean Database (Reverse Order)
        console.log('\n--- Cleaning Database (Delete Phase) ---');
        const deleteOrder = [...modelOrder].reverse();

        for (const key of deleteOrder) {
            const prismaModelName = key;
            const model = (prisma as any)[prismaModelName];

            if (model) {
                try {
                    await model.deleteMany({});
                    console.log(`\u2714 Deleted all from ${prismaModelName}`);
                } catch (e: any) {
                    console.log(`\u274c Error deleting ${prismaModelName}:`, e.message);
                }
            } else {
                console.warn(`\u26a0 Model '${prismaModelName}' not found in Prisma Client`);
            }
        }

        // 2. Insert Data
        console.log('\n--- Inserting Data (Import Phase) ---');
        for (const key of modelOrder) {
            const items = data[key];
            if (!items || !Array.isArray(items) || items.length === 0) {
                console.log(`Skipping ${key} (No data)`);
                continue;
            }

            const prismaModelName = key;
            const model = (prisma as any)[prismaModelName];

            if (!model) {
                console.warn(`Model ${prismaModelName} not found in Prisma Client. Skipping.`);
                continue;
            }

            console.log(`Inserting ${items.length} items into ${prismaModelName}...`);

            let parsedItems = items.map(item => parseDates(item));

            // Enum Mapping for 'tarea'
            if (key === 'tarea') {
                parsedItems = parsedItems.map((item: any) => {
                    // Map Tipo
                    if (item.tipo === 'AVERIA') item.tipo = 'OPERATIVA';

                    // Map Estado
                    if (item.estado === 'CERRADA') item.estado = 'COMPLETADA';
                    if (item.estado === 'ABIERTA') item.estado = 'PENDIENTE';

                    return item;
                });
            }

            try {
                // Attempt createMany for performance
                await model.createMany({
                    data: parsedItems,
                    skipDuplicates: true
                });
                console.log(`\u2714 Inserted ${prismaModelName} successfully.`);

                // 3. Reset Sequences
                const tableName = key.charAt(0).toUpperCase() + key.slice(1);
                try {
                    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${tableName}";`);
                } catch (seqErr: any) {
                    // Ignore
                }

            } catch (e: any) {
                console.error(`\u274c Error batch inserting ${prismaModelName}:`, e.message);
                console.log(`  -> Retrying one-by-one...`);
                for (const item of parsedItems) {
                    try {
                        await model.create({ data: item });
                    } catch (innerE: any) {
                        console.error(`     Failed to insert item ${item.id}:`, innerE.message);
                    }
                }
            }
        }

        console.log('\nRestoration completed successfully.');

    } catch (error) {
        console.error('Fatal error during restoration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
