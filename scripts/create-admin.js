const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.empleado.upsert({
        where: { usuario: 'admin' },
        update: {},
        create: {
            usuario: 'admin',
            nombre: 'Administrador Sistema',
            email: 'admin@empresa.com',
            password: hashedPassword,
            rol: 'ADMIN',
        },
    });

    console.log('Admin user created/verified:', admin.usuario);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
