import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { format } from 'date-fns';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // "YYYY-MM"

        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // Determine date range for the month
        const now = new Date();
        const year = monthParam ? parseInt(monthParam.split('-')[0]) : now.getFullYear();
        const month = monthParam ? parseInt(monthParam.split('-')[1]) - 1 : now.getMonth();

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);

        // Fetch all active employees
        const employees = await prisma.empleado.findMany({
            where: { activo: true },
            select: { id: true, nombre: true, apellidos: true, rol: true },
            orderBy: { nombre: 'asc' }
        });

        // Fetch all shifts for the period
        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                fecha: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                usosCamion: {
                    include: {
                        descargas: true
                    }
                }
            }
        });

        // Aggregate data
        const report = employees.map(emp => {
            const empJornadas = jornadas.filter(j => j.empleadoId === emp.id);

            // Count unique days (by date string)
            const uniqueDays = new Set(empJornadas.map(j => format(new Date(j.fecha), 'yyyy-MM-dd'))).size;

            // Count how many are still "open" (no exit time)
            const openJornadas = empJornadas.filter(j => !j.horaSalida).length;

            let totalKm = 0;
            let totalDescargas = 0;
            const totalMilliseconds = empJornadas.reduce((acc, j) => {
                // Sum km and descargas
                j.usosCamion.forEach(u => {
                    totalKm += (u.kmRecorridos || 0);
                    totalDescargas += (u.descargas?.length || 0);
                });

                if (j.horaSalida && j.horaEntrada) {
                    return acc + (new Date(j.horaSalida).getTime() - new Date(j.horaEntrada).getTime());
                }
                return acc;
            }, 0);

            const totalHours = totalMilliseconds / (1000 * 60 * 60);

            return {
                id: emp.id,
                nombre: `${emp.nombre} ${emp.apellidos || ''}`.trim(),
                rol: emp.rol,
                diasTrabajados: uniqueDays,
                totalHoras: parseFloat(totalHours.toFixed(2)),
                totalKm,
                totalDescargas,
                tieneAbiertas: openJornadas > 0,
                numAbiertas: openJornadas
            };
        });

        return NextResponse.json(report);

    } catch (error) {
        console.error('GET /api/admin/nominas error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
