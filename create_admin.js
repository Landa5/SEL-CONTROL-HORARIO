
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // Assuming bcryptjs is used based on package.json
const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.empleado.upsert({
        where: { email: 'admin@empresa.com' },
        update: {},
        create: {
            email: 'admin@empresa.com',
            nombre: 'Administrador',
            password: hashedPassword,
            rol: 'ADMIN'
        }
    });
    console.log('Admin user:', admin);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
