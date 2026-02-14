import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const me = searchParams.get('me') === 'true';

        // Define filter: Admin/Oficina see all, others see only themselves (unless me=true requested)
        const isAdminOrOffice = session.rol === 'ADMIN' || session.rol === 'OFICINA';
        const userId = Number(session.id);
        const empWhere = (me || !isAdminOrOffice) ? { id: userId } : { activo: true };

        // Get employees (all or self)
        const empleados = await prisma.empleado.findMany({
            where: empWhere,
            select: {
                id: true,
                nombre: true,
                usuario: true,
                diasVacaciones: true,
                diasExtras: true,
                horasExtra: true,
                rol: true,
                compensaciones: {
                    include: { fiesta: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });

        // Get all absences
        const ausencias = await prisma.ausencia.findMany({
            include: {
                empleado: {
                    select: { nombre: true, usuario: true }
                }
            },
            orderBy: { fechaInicio: 'desc' }
        });

        // Aggregate data
        const stats = empleados.map(emp => {
            const empAusencias = ausencias.filter(a => a.empleadoId === emp.id);

            // Calculate used vacation days (only APPROVED)
            const diasDisfrutados = empAusencias
                .filter(a => a.tipo === 'VACACIONES' && a.estado === 'APROBADA')
                .reduce((acc, a) => {
                    const start = new Date(a.fechaInicio);
                    const end = new Date(a.fechaFin);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    return acc + diffDays;
                }, 0);

            // Calculate pending vacation days
            const diasSolicitados = empAusencias
                .filter(a => a.tipo === 'VACACIONES' && a.estado === 'PENDIENTE')
                .reduce((acc, a) => {
                    const start = new Date(a.fechaInicio);
                    const end = new Date(a.fechaFin);
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    return acc + diffDays;
                }, 0);

            // Calculate all pending requests count (Vacations + Sick Leave + Permissions)
            const numSolicitudesPendientes = empAusencias.filter(a => a.estado === 'PENDIENTE').length;

            // Enhance absences with overlap info
            const enrichedAusencias = empAusencias.map(a => {
                if (a.estado !== 'PENDIENTE') return a;

                const startA = new Date(a.fechaInicio);
                const endA = new Date(a.fechaFin);

                // Find overlaps with APPROVED absences of OTHER employees
                const conflicts = ausencias.filter(other => {
                    if (other.empleadoId === emp.id) return false; // Skip self
                    if (other.estado !== 'APROBADA') return false; // Only check against approved

                    const startB = new Date(other.fechaInicio);
                    const endB = new Date(other.fechaFin);

                    // Check overlap: StartA <= EndB && EndA >= StartB
                    return startA <= endB && endA >= startB;
                }).map(c => ({
                    empleadoNombre: c.empleado.nombre,
                    tipo: c.tipo
                }));

                return { ...a, overlaps: conflicts };
            });

            return {
                empleadoId: emp.id,
                nombre: emp.nombre,
                usuario: emp.usuario,
                rol: emp.rol,
                totalVacaciones: emp.diasVacaciones || 30,
                diasExtras: emp.diasExtras || 0,
                horasExtra: emp.horasExtra || 0,
                diasDisfrutados,
                diasRestantes: (emp.diasVacaciones || 30) + (emp.diasExtras || 0) - diasDisfrutados,
                diasSolicitados,
                numSolicitudesPendientes,
                ausencias: enrichedAusencias,
                compensaciones: emp.compensaciones
            };
        });
        return NextResponse.json(stats);
    } catch (error) {
        console.error('Error getting absence stats:', error);
        return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
    }
}
