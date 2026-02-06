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
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        // Get jornadas from last 7 days for this user
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId: user.id,
                fecha: { gte: sevenDaysAgo }
            },
            include: {
                usosCamion: {
                    include: {
                        descargas: true,
                        camion: { select: { id: true, matricula: true } }
                    }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        // Calculate stats
        let totalDescargas = 0;
        const camionesSet = new Set<number>();
        const descargasPorDia: { fecha: string; count: number; km: number }[] = [];

        jornadas.forEach(jornada => {
            let descargasDia = 0;
            let kmDia = 0;
            jornada.usosCamion.forEach(uso => {
                totalDescargas += uso.descargas.length;
                descargasDia += uso.descargas.length;
                if (uso.kmRecorridos) kmDia += uso.kmRecorridos;
                if (uso.camion) camionesSet.add(uso.camion.id);
            });
            // Include days with activity (downloads OR km)
            if (descargasDia > 0 || kmDia > 0) {
                descargasPorDia.push({
                    fecha: jornada.fecha.toISOString(),
                    count: descargasDia,
                    km: kmDia
                });
            }
        });

        return NextResponse.json({
            totalDescargas,
            camionesUnicos: camionesSet.size,
            descargasPorDia: descargasPorDia.slice(0, 7) // Last 7 days max
        });
    } catch (error) {
        console.error('GET /api/jornadas/historico error:', error);
        return NextResponse.json({ error: 'Error al obtener histórico' }, { status: 500 });
    }
}
