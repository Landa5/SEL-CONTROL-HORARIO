import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Default to current month if no dates provided
    const startDate = from ? startOfDay(parseISO(from)) : startOfMonth(new Date());
    const endDate = to ? endOfDay(parseISO(to)) : endOfDay(new Date());

    try {
        const usos = await prisma.usoCamion.findMany({
            where: {
                horaInicio: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                camion: true
            }
        });

        // Agregación de datos por camión
        const truckStats: Record<number, any> = {};

        usos.forEach((uso: any) => {
            const truckId = uso.camionId;
            if (!truckStats[truckId]) {
                truckStats[truckId] = {
                    id: truckId,
                    matricula: uso.camion.matricula,
                    modelo: uso.camion.modelo,
                    kmTotales: 0,
                    litrosTotales: 0,
                    viajes: 0,
                    descargas: 0
                };
            }

            // Calcular KM si no está guardado explícitamente o asegurar que no sea negativo
            // Priorizamos kmRecorridos guardado, si no calculamos.
            let km = uso.kmRecorridos !== null ? uso.kmRecorridos : 0;

            // Fallback: si es 0 y tenemos datos para calcularlo (reparación de datos antiguos)
            if (km === 0 && uso.kmFinal && uso.kmInicial) {
                const diff = uso.kmFinal - uso.kmInicial;
                km = diff > 0 ? diff : 0;
            }

            // Safety check: nunca sumar negativos
            if (km < 0) km = 0;

            truckStats[truckId].kmTotales += km;
            truckStats[truckId].litrosTotales += uso.litrosRepostados || 0;
            truckStats[truckId].viajes += uso.viajesCount || 0;
            truckStats[truckId].descargas += uso.descargasCount || (uso.descargas?.length || 0); // Asumiendo que descargas podría ser array en tipo pero aquí usamos count
        });

        // Convertir a array y calcular medias
        const result = Object.values(truckStats).map(stat => {
            const consumoMedio = stat.kmTotales > 0
                ? (stat.litrosTotales / stat.kmTotales) * 100
                : 0;

            // Coste estimado (ej. 1.5€/litro) - Esto podría venir de configuración
            const costeCombustible = stat.litrosTotales * 1.5;

            return {
                ...stat,
                consumoMedio: parseFloat(consumoMedio.toFixed(2)),
                costeCombustible: parseFloat(costeCombustible.toFixed(2))
            };
        });

        // Totales Globales
        const globalStats = result.reduce((acc, curr) => ({
            totalKm: acc.totalKm + curr.kmTotales,
            totalLitros: acc.totalLitros + curr.litrosTotales,
            totalViajes: acc.totalViajes + curr.viajes,
            totalCoste: acc.totalCoste + curr.costeCombustible
        }), { totalKm: 0, totalLitros: 0, totalViajes: 0, totalCoste: 0 });

        const globalConsumo = globalStats.totalKm > 0
            ? (globalStats.totalLitros / globalStats.totalKm) * 100
            : 0;

        return NextResponse.json({
            data: result.sort((a, b) => b.kmTotales - a.kmTotales),
            summary: {
                ...globalStats,
                consumoMedio: parseFloat(globalConsumo.toFixed(2))
            },
            period: { from: startDate, to: endDate }
        });

    } catch (error) {
        console.error("Error fetching fleet stats:", error);
        return NextResponse.json({ error: 'Error fetching stats' }, { status: 500 });
    }
}
