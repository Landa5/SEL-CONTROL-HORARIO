
import { prisma } from '@/lib/prisma';

async function main() {
    const names = ['Luis', 'Molina', 'Ruben', 'Peres', 'Perez', 'Juan', 'Jose', 'Redon', 'Pascual', 'Graullera'];
    const employees = await prisma.empleado.findMany({
        where: {
            OR: names.map(n => ({
                OR: [
                    { nombre: { contains: n } },
                    { apellidos: { contains: n } }
                ]
            }))
        }
    });

    console.log('Found Employees:');
    employees.forEach(e => console.log(`${e.id}: ${e.nombre} ${e.apellidos} (${e.rol})`));
}

main();
