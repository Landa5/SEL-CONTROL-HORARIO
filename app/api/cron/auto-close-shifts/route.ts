import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Crea un Date UTC que corresponde a las 23:30 hora española (Europe/Madrid) del día dado.
 * Usa Intl para determinar dinámicamente el offset (maneja CET/CEST automáticamente).
 */
function getSpanish2330(fecha: Date): Date {
    const dayStr = fecha.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }); // YYYY-MM-DD

    // Creamos 12:00 UTC del día para consultar el offset de Madrid en ese momento
    const noon = new Date(`${dayStr}T12:00:00.000Z`);
    const madridParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        hour: 'numeric', hour12: false,
    }).formatToParts(noon);
    const madridHourAtNoonUTC = parseInt(madridParts.find(p => p.type === 'hour')?.value || '12');
    const offsetHours = madridHourAtNoonUTC - 12; // +1 (CET) or +2 (CEST)

    // 23:30 Madrid → (23:30 - offset) UTC
    const utcHour = 23 - offsetHours;
    return new Date(`${dayStr}T${utcHour.toString().padStart(2, '0')}:30:00.000Z`);
}

export async function GET(request: Request) {
    try {
        // Protección: solo permitir con CRON_SECRET
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();

        // Find all open shifts (include ALL truck usages, not just open ones)
        const openShifts = await prisma.jornadaLaboral.findMany({
            where: {
                horaSalida: null
            },
            include: {
                usosCamion: {
                    orderBy: { horaFin: 'desc' }
                }
            }
        });

        if (openShifts.length === 0) {
            return NextResponse.json({ success: true, message: 'No open shifts found.' });
        }

        let closedJornadas = 0;
        let closedUsos = 0;

        for (const jornada of openShifts) {
            // 23:30 hora española del día de la jornada
            const cutoffTime = getSpanish2330(jornada.fecha);

            // Solo cerrar si ya pasamos de las 23:30
            if (now < cutoffTime) continue;

            // Determinar hora real de cierre:
            // 1. Si hay un UsoCamion ya cerrado, usar su horaFin como referencia
            // 2. Si no, usar las 23:30 españolas
            const closedUsages = jornada.usosCamion.filter((u: any) => u.horaFin !== null);
            const openUsages = jornada.usosCamion.filter((u: any) => u.horaFin === null);

            // Encontrar la última actividad conocida
            let lastActivityTime: Date | null = null;
            if (closedUsages.length > 0) {
                lastActivityTime = closedUsages[0].horaFin; // Ya ordenados desc
            }

            // Hora de cierre: usar última actividad si existe, si no 23:30
            const effectiveCloseTime = lastActivityTime || cutoffTime;

            // Cerrar usos de camión abiertos (los que olvidaron cerrar)
            for (const uso of openUsages) {
                const usoCloseTime = lastActivityTime || cutoffTime;
                await prisma.usoCamion.update({
                    where: { id: uso.id },
                    data: {
                        horaFin: usoCloseTime,
                        kmFinal: uso.kmFinal || uso.kmInicial,
                        kmRecorridos: uso.kmFinal ? (uso.kmFinal - uso.kmInicial) : 0,
                        notas: uso.notas ? `${uso.notas} | Cierre auto` : 'Cierre auto'
                    }
                });
                closedUsos++;
            }

            // Calcular total horas con la hora de cierre efectiva
            const diff = effectiveCloseTime.getTime() - jornada.horaEntrada.getTime();
            const totalHours = Math.max(0, parseFloat((diff / (1000 * 60 * 60)).toFixed(2)));
            
            const closeNote = lastActivityTime
                ? 'Cierre automático (última actividad camión)'
                : 'Cierre automático 23:30';

            // Cerrar la jornada
            await prisma.jornadaLaboral.update({
                where: { id: jornada.id },
                data: {
                    horaSalida: effectiveCloseTime,
                    totalHoras: totalHours,
                    estado: 'CERRADA',
                    observaciones: jornada.observaciones
                        ? `${jornada.observaciones} | ${closeNote}`
                        : `*${closeNote}*`
                }
            });
            closedJornadas++;
        }

        return NextResponse.json({
            success: true,
            message: `Closed ${closedJornadas} open shifts and ${closedUsos} open truck usages.`
        });

    } catch (error) {
        console.error('Error auto-closing shifts:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
