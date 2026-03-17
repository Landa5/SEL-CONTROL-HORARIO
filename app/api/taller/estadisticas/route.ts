import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/taller/estadisticas - Dashboard analítico de averías
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Solo ADMIN, OFICINA y MECANICO pueden ver estadísticas
    if (!['ADMIN', 'OFICINA', 'MECANICO'].includes(session.rol as string)) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const periodo = searchParams.get('periodo') || '30'; // días
        const desde = new Date();
        desde.setDate(desde.getDate() - Number(periodo));

        // Averías activas (no completadas ni canceladas)
        const averiasActivas = await prisma.tarea.count({
            where: { tipo: 'TALLER', estado: { notIn: ['COMPLETADA', 'CANCELADA'] } }
        });

        // Vehículos inmovilizados
        const vehiculosInmovilizados = await prisma.tareaTaller.count({
            where: {
                vehiculoInmovilizado: true,
                tarea: { estado: { notIn: ['COMPLETADA', 'CANCELADA'] } }
            }
        });

        // Coste acumulado en el período
        const costes = await prisma.tareaTaller.aggregate({
            _sum: { costeFinal: true },
            _avg: { costeFinal: true },
            _count: true,
            where: {
                costeFinal: { not: null },
                tarea: { fechaCierre: { gte: desde } }
            }
        });

        // Averías por tipo
        const porTipo = await prisma.tareaTaller.groupBy({
            by: ['tipoAveria'],
            _count: true,
            where: {
                tipoAveria: { not: null },
                tarea: { createdAt: { gte: desde } }
            },
            orderBy: { _count: { tipoAveria: 'desc' } }
        });

        // Averías por camión (top 10)
        const porCamion = await prisma.tarea.groupBy({
            by: ['camionId'],
            _count: true,
            where: {
                tipo: 'TALLER',
                camionId: { not: null },
                createdAt: { gte: desde }
            },
            orderBy: { _count: { camionId: 'desc' } },
            take: 10,
        });

        // Enriquecer con datos de camión
        const camionIds = porCamion.map(item => item.camionId).filter(Boolean) as number[];
        const camiones = await prisma.camion.findMany({
            where: { id: { in: camionIds } },
            select: { id: true, matricula: true, modelo: true }
        });
        const camionesMap = Object.fromEntries(camiones.map(c => [c.id, c]));

        const porCamionEnriquecido = porCamion.map(item => ({
            camionId: item.camionId,
            camion: camionesMap[item.camionId!] || null,
            count: item._count,
        }));

        // Tiempo medio de resolución (días)
        const tiempoResolucion = await prisma.$queryRaw<{avg_hours: number}[]>`
            SELECT AVG(EXTRACT(EPOCH FROM ("fechaCierre" - "fechaInicio")) / 3600) as avg_hours
            FROM "Tarea"
            WHERE tipo = 'TALLER'
              AND "fechaCierre" IS NOT NULL
              AND "fechaCierre" >= ${desde}
        `;

        return NextResponse.json({
            averiasActivas,
            vehiculosInmovilizados,
            costeTotal: costes._sum.costeFinal || 0,
            costeMedio: costes._avg.costeFinal || 0,
            totalCerradas: costes._count,
            porTipo: porTipo.map(item => ({
                tipo: item.tipoAveria,
                count: item._count,
            })),
            porCamion: porCamionEnriquecido,
            tiempoMedioResolucionHoras: tiempoResolucion[0]?.avg_hours || 0,
            periodo: Number(periodo),
        });

    } catch (error) {
        console.error('Error estadísticas taller:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
