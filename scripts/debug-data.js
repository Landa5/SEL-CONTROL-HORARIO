const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const jornadas = await prisma.jornadaLaboral.findMany({
        include: {
            usosCamion: {
                include: {
                    descargas: true
                }
            }
        }
    });
    console.log(JSON.stringify(jornadas, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
