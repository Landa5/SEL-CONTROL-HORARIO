import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const activeEmployees = await prisma.empleado.count({
            where: { activo: true }
        });

        const activeTrucks = await prisma.camion.count({
            where: { activo: true }
        });

        const openIncidents = await prisma.tarea.count({
            where: { estado: { in: ['ABIERTA', 'EN_CURSO'] } }
        });

        // Current status
        const activeClockIns = await prisma.jornadaLaboral.count({
            where: { estado: 'TRABAJANDO' }
        });

        const pendingAbsences = await prisma.ausencia.count({
            where: { estado: 'PENDIENTE' }
        });

        // Monthly Totals
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const downloadsThisMonth = await prisma.descarga.count({
            where: { hora: { gte: startOfMonth } }
        });

        const monthlyHoursAgg = await prisma.jornadaLaboral.aggregate({
            where: {
                fecha: { gte: startOfMonth },
                estado: 'CERRADA'
            },
            _sum: {
                totalHoras: true
            }
        });

        const monthlyKmAgg = await prisma.usoCamion.aggregate({
            where: {
                horaInicio: { gte: startOfMonth }
            },
            _sum: {
                kmRecorridos: true
            }
        });

        const totalMonthlyHours = monthlyHoursAgg._sum.totalHoras || 0;
        const totalMonthlyKm = monthlyKmAgg._sum.kmRecorridos || 0;

        // Check for upcoming fleet expirations (next 40 days)
        const expirationThreshold = new Date();
        expirationThreshold.setDate(expirationThreshold.getDate() + 40);

        const expiringTrucks = await prisma.camion.findMany({
            where: {
                activo: true,
                OR: [
                    { itvVencimiento: { lte: expirationThreshold } },
                    { seguroVencimiento: { lte: expirationThreshold } },
                    { tacografoVencimiento: { lte: expirationThreshold } },
                    { adrVencimiento: { lte: expirationThreshold } }
                ]
            },
            select: {
                id: true,
                matricula: true,
                itvVencimiento: true,
                seguroVencimiento: true,
                tacografoVencimiento: true,
                adrVencimiento: true
            }
        });

        // Filter and format the expirations that are actually upcoming/past
        const upcomingExpirations = expiringTrucks.flatMap(truck => {
            const alerts: any[] = [];
            const check = (date: Date | null, type: string) => {
                if (date && date <= expirationThreshold) {
                    alerts.push({
                        truckId: truck.id,
                        matricula: truck.matricula,
                        type,
                        date,
                        isExpired: date < new Date()
                    });
                }
            };
            check(truck.itvVencimiento, 'ITV');
            check(truck.seguroVencimiento, 'Seguro');
            check(truck.tacografoVencimiento, 'Tacógrafo');
            check(truck.adrVencimiento, 'ADR');
            return alerts;
        });

        return NextResponse.json({
            activeEmployees,
            activeTrucks,
            openIncidents,
            downloadsThisMonth,
            activeClockIns,
            pendingAbsences,
            totalMonthlyHours,
            totalMonthlyKm,
            upcomingExpirations
        });

    } catch (error) {
        console.error('GET /api/admin/dashboard error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
