
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- CALCULATING STATS DIRECTLY ---');

    // Get all employees
    const empleados = await prisma.empleado.findMany({
        where: { activo: true },
        select: { id: true, nombre: true, diasVacaciones: true }
    });

    // Get all absences
    const ausencias = await prisma.ausencia.findMany();

    // Aggregate data logic (mirroring the API)
    const stats = empleados.map(emp => {
        const empAusencias = ausencias.filter(a => a.empleadoId === emp.id);

        const diasDisfrutados = empAusencias
            .filter(a => a.tipo === 'VACACIONES' && a.estado === 'APROBADA')
            .reduce((acc, a) => {
                const start = new Date(a.fechaInicio);
                const end = new Date(a.fechaFin);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return acc + diffDays;
            }, 0);

        const diasSolicitados = empAusencias
            .filter(a => a.tipo === 'VACACIONES' && a.estado === 'PENDIENTE')
            .reduce((acc, a) => {
                const start = new Date(a.fechaInicio);
                const end = new Date(a.fechaFin);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return acc + diffDays;
            }, 0);

        return {
            nombre: emp.nombre,
            total: emp.diasVacaciones || 30,
            usados: diasDisfrutados,
            pendientes: diasSolicitados,
            restantes: (emp.diasVacaciones || 30) - diasDisfrutados
        };
    });

    console.log(stats);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
