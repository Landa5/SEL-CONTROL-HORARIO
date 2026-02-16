import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const OUTPUT_FILE = path.join(process.cwd(), 'scripts', 'data_dump.json');
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backups dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

async function main() {
    console.log('Starting database backup...');

    // Models to backup
    // We can add more models as the schema evolves
    const models = [
        'fiestaLocal',
        'conceptoNomina',
        'configuracionNegocio',
        'empleado',
        'camion',
        'tarifaNomina',
        'notificacion',
        'nominaMes',
        'nominaLinea',
        'ausencia',
        'jornadaLaboral',
        'usoCamion',
        'descarga',
        'tarea',
        'tareaHistorial',
        'mantenimientoRealizado',
        // Add other models here if needed
    ];

    const backupData: Record<string, any[]> = {};

    try {
        for (const modelName of models) {
            console.log(`Backing up ${modelName}...`);
            try {
                const model = (prisma as any)[modelName];
                if (model) {
                    const data = await model.findMany();
                    backupData[modelName] = data;
                    console.log(`  -> ${data.length} records found.`);
                } else {
                    console.warn(`  -> Model ${modelName} not found in Prisma Client.`);
                }
            } catch (err: any) {
                console.error(`  -> Error backing up ${modelName}:`, err.message);
            }
        }

        // 1. Write to main dump file (for quick restore)
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(backupData, null, 2));
        console.log(`\nBackup saved to: ${OUTPUT_FILE}`);

        // 2. Write to timestamped file (for history)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const historyFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
        fs.writeFileSync(historyFile, JSON.stringify(backupData, null, 2));
        console.log(`History backup saved to: ${historyFile}`);

    } catch (error) {
        console.error('Fatal error during backup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
