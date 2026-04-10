
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // SEGURIDAD: Las contraseñas deben cambiarse después del primer login.
    // Estas son contraseñas temporales SOLO para el seed inicial.
    const defaultPass = process.env.SEED_DEFAULT_PASSWORD || '1234';
    const adminDefaultPass = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    
    console.log('⚠️  IMPORTANTE: Cambia las contraseñas después del primer login.');
    
    const password = await bcrypt.hash(defaultPass, 10);
    const adminPass = await bcrypt.hash(adminDefaultPass, 10);

    const users = [
        {
            usuario: 'admin',
            email: 'admin@empresa.com',
            nombre: 'Administrador Principal',
            rol: 'ADMIN',
            password: adminPass
        },
        {
            usuario: 'oficina',
            email: 'oficina@empresa.com',
            nombre: 'Marta Oficina',
            rol: 'OFICINA',
            password: password
        },
        {
            usuario: 'manolo',
            email: 'manolo@empresa.com',
            nombre: 'Manolo Conductor',
            rol: 'CONDUCTOR',
            password: password
        },
        {
            usuario: 'taller',
            email: 'mecanico@empresa.com',
            nombre: 'Paco Mecánico',
            rol: 'MECANICO',
            password: password
        }
    ];

    for (const u of users) {
        const existing = await prisma.empleado.findUnique({
            where: {
                usuario: u.usuario,
            },
        });
        if (!existing) {
            await prisma.empleado.create({ data: u });
            console.log(`Created user: ${u.usuario} (${u.rol})`);
        } else {
            console.log(`Updated user: ${u.usuario}`);
            await prisma.empleado.update({
                where: { usuario: u.usuario },
                data: {
                    rol: u.rol,
                    password: u.password
                }
            });
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
