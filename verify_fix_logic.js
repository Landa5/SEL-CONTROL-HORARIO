const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLogic(role, isMeParam) {
    console.log(`\n--- Testing Role: ${role}, ?me=${isMeParam} ---`);

    // 1. Find a user with this role
    const user = await prisma.empleado.findFirst({ where: { rol: role } });
    if (!user) {
        console.log("No user found for this role.");
        return;
    }
    console.log(`User: ${user.nombre} (${user.id})`);

    // 2. Simulate Route Logic
    const session = { rol: role, id: user.id };
    const me = isMeParam; // simulated query param

    const isAdminOrOffice = session.rol === 'ADMIN' || session.rol === 'OFICINA';
    const userId = Number(session.id);

    console.log(`Debug: isAdminOrOffice=${isAdminOrOffice}, userId=${userId}`);

    const empWhere = (me || !isAdminOrOffice) ? { id: userId } : { activo: true };
    console.log(`Query Where:`, JSON.stringify(empWhere));

    const results = await prisma.empleado.findMany({
        where: empWhere,
        select: { id: true, nombre: true }
    });

    console.log(`Results Found: ${results.length}`);
    if (results.length > 0) {
        console.log(`First Result: ${results[0].nombre} (${results[0].id})`);
    }

    // Validation
    if (results.length === 0) {
        console.log("FAIL: No results found.");
    } else if (me && results.length > 1) {
        console.log("FAIL: Requested 'me' but got multiple.");
    } else if (me && results[0].id !== userId) {
        console.log("FAIL: Requested 'me' but got someone else.");
    } else if (!me && isAdminOrOffice && results.length === 1) {
        // This is technically possible if only 1 employee exists, but assuming seed data has more
        const total = await prisma.empleado.count();
        if (total > 1) console.log("WARNING: Admin view should return all, but got 1?");
    } else {
        console.log("SUCCESS: Logic appears correct.");
    }
}

async function main() {
    await testLogic('ADMIN', true);   // Admin asking for own stats (Widget)
    await testLogic('ADMIN', false);  // Admin asking for all stats (Management View)
    await testLogic('CONDUCTOR', true); // Driver asking for own stats (Widget)
    await testLogic('CONDUCTOR', false); // Driver asking for all (Should fallback to own)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
