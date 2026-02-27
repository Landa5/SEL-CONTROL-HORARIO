import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const now = new Date();

        // Find all open shifts
        const openShifts = await prisma.jornadaLaboral.findMany({
            where: {
                horaSalida: null
            },
            include: {
                usosCamion: {
                    where: {
                        horaFin: null
                    }
                }
            }
        });

        if (openShifts.length === 0) {
            return NextResponse.json({ success: true, message: 'No open shifts found.' });
        }

        let closedJornadas = 0;
        let closedUsos = 0;

        for (const jornada of openShifts) {
            // Determine the close time: 23:30 of the shift's date
            const closeTime = new Date(jornada.fecha);
            closeTime.setHours(23, 30, 0, 0);

            const finalCloseTime = now > closeTime ? closeTime : now;

            // Close any open truck usages
            for (const uso of jornada.usosCamion) {
                await prisma.usoCamion.update({
                    where: { id: uso.id },
                    data: {
                        horaFin: finalCloseTime,
                        notas: uso.notas ? `${uso.notas} | Cierre auto 23:30` : 'Cierre auto 23:30'
                    }
                });
                closedUsos++;
            }

            // Calculate total hours
            const diff = finalCloseTime.getTime() - jornada.horaEntrada.getTime();
            const totalHours = Math.max(0, parseFloat((diff / (1000 * 60 * 60)).toFixed(2)));

            // Close the shift
            await prisma.jornadaLaboral.update({
                where: { id: jornada.id },
                data: {
                    horaSalida: finalCloseTime,
                    totalHoras: totalHours,
                    estado: 'CERRADA',
                    observaciones: jornada.observaciones ? `${jornada.observaciones} | Cierre automático 23:30` : 'Cierre automático 23:30'
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
