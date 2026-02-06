
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.empleado.findMany();
    console.log(users.map(u => ({ id: u.id, user: u.usuario, rol: u.rol })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
