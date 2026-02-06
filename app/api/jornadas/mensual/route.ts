import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // "YYYY-MM"

        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        if (monthParam) {
            // DETAILED VIEW FOR SPECIFIC MONTH
            const [year, month] = monthParam.split('-').map(Number);
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const jornadas = await prisma.jornadaLaboral.findMany({
                where: {
                    empleadoId: user.id,
                    fecha: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                orderBy: { fecha: 'desc' },
                include: {
                    usosCamion: {
                        include: { descargas: true }
                    }
                }
            });

            const dailyData = jornadas.map(j => {
                const totalDescargas = j.usosCamion.reduce((acc, uso) => acc + (uso.descargasCount || 0), 0);
                const totalViajes = j.usosCamion.reduce((acc, uso) => acc + (uso.viajesCount || 0), 0);
                const totalKm = j.usosCamion.reduce((acc, uso) => acc + (uso.kmRecorridos || 0), 0);

                return {
                    id: j.id,
                    fecha: j.fecha,
                    horaEntrada: j.horaEntrada,
                    horaSalida: j.horaSalida,
                    km: totalKm,
                    descargas: totalDescargas,
                    viajes: totalViajes,
                    estado: j.estado
                };
            });

            return NextResponse.json(dailyData);

        } else {
            // MONTHLY SUMMARY VIEW
            // Get all jornadas to aggregate
            const jornadas = await prisma.jornadaLaboral.findMany({
                where: { empleadoId: user.id },
                orderBy: { fecha: 'desc' },
                include: {
                    usosCamion: true
                }
            });

            // Aggregate by month
            const monthlyStats = new Map();

            jornadas.forEach(j => {
                const monthKey = j.fecha.toISOString().slice(0, 7); // "YYYY-MM"

                if (!monthlyStats.has(monthKey)) {
                    monthlyStats.set(monthKey, { month: monthKey, totalKm: 0, totalDescargas: 0, totalViajes: 0, jornadasCount: 0, totalHoras: 0 });
                }

                const stat = monthlyStats.get(monthKey);
                stat.jornadasCount++;

                if (j.horaEntrada && j.horaSalida) {
                    const diff = new Date(j.horaSalida).getTime() - new Date(j.horaEntrada).getTime();
                    stat.totalHoras += diff / (1000 * 60 * 60);
                }

                j.usosCamion.forEach(u => {
                    stat.totalKm += (u.kmRecorridos || 0);
                    stat.totalDescargas += (u.descargasCount || 0);
                    stat.totalViajes += (u.viajesCount || 0);
                });
            });

            return NextResponse.json(Array.from(monthlyStats.values()));
        }

    } catch (error) {
        console.error('GET /api/jornadas/mensual error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
