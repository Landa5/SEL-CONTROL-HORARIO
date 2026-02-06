const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Verifying API logic simulation...");

    // 1. Simulate finding Admin
    const admin = await prisma.empleado.findFirst({ where: { rol: 'ADMIN' } });
    if (!admin) {
        console.log("No admin found");
        return;
    }
    console.log(`Admin found: ${admin.nombre} (${admin.id})`);

    // Simulate API logic for Admin
    const isAdminOrOffice = true;
    const empWhere = isAdminOrOffice ? { activo: true } : { id: admin.id };

    const results = await prisma.empleado.findMany({
        where: empWhere,
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' }
    });

    console.log(`API would return ${results.length} records for Admin.`);
    console.log(`First record is: ${results[0].nombre} (${results[0].id})`);

    if (results[0].id !== admin.id) {
        console.log("CRITICAL: Admin would see wrong person's stats in summary!");
    } else {
        console.log("Admin happens to be first alphabetically.");
    }

    // 2. Simulate finding Conductor
    const driver = await prisma.empleado.findFirst({ where: { rol: 'CONDUCTOR' } });
    if (driver) {
        console.log(`Driver found: ${driver.nombre} (${driver.id})`);
        const isDriverAdmin = false;
        const driverWhere = isDriverAdmin ? { activo: true } : { id: driver.id };
        const driverResults = await prisma.empleado.findMany({
            where: driverWhere,
            select: { id: true, nombre: true }
        });
        console.log(`API would return ${driverResults.length} records for Driver.`);
        console.log(`Record is: ${driverResults[0].nombre}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
