import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO } from 'date-fns';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const camionId = parseInt(params.id);

        // Default to current month if no dates provided
        const startDate = from ? startOfDay(parseISO(from)) : startOfMonth(new Date());
        const endDate = to ? endOfDay(parseISO(to)) : endOfDay(new Date());

        // 1. Fetch Truck Details
        const camion = await prisma.camion.findUnique({
            where: { id: camionId }
        });

        if (!camion) {
            return NextResponse.json({ error: 'Camión no encontrado' }, { status: 404 });
        }

        // 2. Fetch Usage Records in Range
        // We filter by 'horaInicio' of the usage
        const usos = await prisma.usoCamion.findMany({
            where: {
                camionId: camionId,
                horaInicio: {
                    gte: startDate,
                    lte: endDate
                },
                // Ensure we only count finished or valid segments for stats if needed, 
                // but usually we want everything.
            },
            include: {
                jornada: {
                    include: {
                        empleado: true
                    }
                }
            },
            orderBy: {
                horaInicio: 'desc'
            }
        });

        // 3. Aggregate Data
        let totalKm = 0;
        let totalLitros = 0;
        let totalViajes = 0;
        let totalDescargas = 0;

        // Daily grouping
        const dailyMap = new Map<string, any>();

        usos.forEach(uso => {
            // Robust KM calculation
            let km = uso.kmRecorridos !== null ? uso.kmRecorridos : 0;

            if (km === 0 && uso.kmFinal && uso.kmInicial) {
                const diff = uso.kmFinal - uso.kmInicial;
                km = diff > 0 ? diff : 0;
            }
            if (km < 0) km = 0;
            const litros = uso.litrosRepostados || 0;

            totalKm += km;
            totalLitros += litros;
            totalViajes += uso.viajesCount || 0;
            totalDescargas += uso.descargasCount || 0; // Assuming descargasCount is used

            // Group by Day (YYYY-MM-DD)
            const dayKey = uso.horaInicio.toISOString().split('T')[0];
            if (!dailyMap.has(dayKey)) {
                dailyMap.set(dayKey, {
                    date: dayKey,
                    km: 0,
                    litros: 0,
                    viajes: 0,
                    descargas: 0,
                    conductores: new Set()
                });
            }
            const dayStats = dailyMap.get(dayKey);
            dayStats.km += km;
            dayStats.litros += litros;
            dayStats.viajes += (uso.viajesCount || 0);
            dayStats.descargas += (uso.descargasCount || 0);
            if (uso.jornada?.empleado) {
                dayStats.conductores.add(uso.jornada.empleado.nombre + ' ' + (uso.jornada.empleado.apellidos || ''));
            }
        });

        // Calculate Average Consumption (L/100km)
        // Avoid division by zero
        const consumoMedio = totalKm > 0 ? (totalLitros / totalKm) * 100 : 0;

        // Convert Map to sorted Array
        const dailyStats = Array.from(dailyMap.values())
            .map(d => ({
                ...d,
                conductores: Array.from(d.conductores) // Convert Set to Array
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            camion,
            periodo: {
                desde: startDate,
                hasta: endDate
            },
            totales: {
                km: totalKm,
                litros: totalLitros,
                consumoMedio: parseFloat(consumoMedio.toFixed(2)),
                viajes: totalViajes,
                descargas: totalDescargas
            },
            diario: dailyStats,
            registros: usos // Return raw records for the detailed table
        });

    } catch (error) {
        console.error('Error fetching truck stats:', error);
        return NextResponse.json({ error: 'Error calculando estadísticas' }, { status: 500 });
    }
}
