import { prisma } from '../lib/prisma';

async function main() {
    const oscars = await prisma.empleado.findMany({
        where: {
            nombre: {
                contains: 'Oscar',
                mode: 'insensitive' // Ensure case-insensitive search if supported by DB (Postgres supports it)
            }
        }
    });

    console.log(JSON.stringify(oscars.map(o => ({ id: o.id, nombre: o.nombre, rol: o.rol, activo: o.activo })), null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
