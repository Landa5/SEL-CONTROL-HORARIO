import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { eachDayOfInterval, isWeekend, format } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { startDate, endDate, excludeNonWorking } = body;

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Fechas requeridas' }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const daysInterval = eachDayOfInterval({ start, end });

        const totalDays = daysInterval.length;

        if (!excludeNonWorking) {
            return NextResponse.json({
                days: totalDays,
                workingDays: totalDays,
                details: []
            });
        }

        // Fetch Holidays
        const holidays = await prisma.fiestaLocal.findMany({
            where: {
                fecha: {
                    gte: start,
                    lte: end
                },
                activa: true
            }
        });

        // Calculate Working Days
        let workingDays = 0;
        const details: string[] = [];

        daysInterval.forEach(day => {
            const isWe = isWeekend(day);
            const holiday = holidays.find(h =>
                h.fecha.getDate() === day.getDate() &&
                h.fecha.getMonth() === day.getMonth() &&
                h.fecha.getFullYear() === day.getFullYear()
            );

            if (isWe) {
                details.push(`${format(day, 'yyyy-MM-dd')}: Fin de semana`);
            } else if (holiday) {
                details.push(`${format(day, 'yyyy-MM-dd')}: Festivo (${holiday.nombre})`);
            } else {
                workingDays++;
            }
        });

        return NextResponse.json({
            days: totalDays,
            workingDays,
            details
        });

    } catch (error) {
        console.error('Error calculating days:', error);
        return NextResponse.json({ error: 'Error de cálculo' }, { status: 500 });
    }
}
