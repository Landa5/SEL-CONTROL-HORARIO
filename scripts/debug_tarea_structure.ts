import fs from 'fs';
import path from 'path';

const DUMP_FILE = path.join(process.cwd(), 'scripts', 'data_dump.json');

try {
    const data = JSON.parse(fs.readFileSync(DUMP_FILE, 'utf-8'));

    if (data.tarea && data.tarea.length > 0) {
        console.log('Tarea found:', data.tarea.length);
        console.log('First Tarea item:', JSON.stringify(data.tarea[0], null, 2));

        // Check for unique Enums
        const tipos = new Set(data.tarea.map((t: any) => t.tipo));
        const estados = new Set(data.tarea.map((t: any) => t.estado));
        const prioridades = new Set(data.tarea.map((t: any) => t.prioridad));

        console.log('Tipos:', [...tipos]);
        console.log('Estados:', [...estados]);
        console.log('Prioridades:', [...prioridades]);
    } else {
        console.log('Tarea array is empty or missing');
    }

} catch (e) {
    console.error(e);
}
