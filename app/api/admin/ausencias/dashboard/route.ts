import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, addDays, isWithinInterval } from 'date-fns';

export async function GET() {
    try {
        const today = new Date();
        const startToday = startOfDay(today);
        const endToday = endOfDay(today);
        const next3Days = addDays(today, 3);

        // 1. Who is absent TODAY?
        const absentToday = await prisma.ausencia.findMany({
            where: {
                estado: 'APROBADA',
                fechaInicio: { lte: endToday },
                fechaFin: { gte: startToday }
            },
            include: {
                empleado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellidos: true,
                        rol: true
                    }
                }
            }
        });

        // 2. Upcoming Absences (Next 3 days)
        const upcomingAbsences = await prisma.ausencia.findMany({
            where: {
                estado: 'APROBADA',
                fechaInicio: {
                    gt: endToday,
                    lte: next3Days
                }
            },
            include: {
                empleado: {
                    select: {
                        nombre: true,
                        apellidos: true
                    }
                }
            },
            orderBy: {
                fechaInicio: 'asc'
            }
        });

        // 3. Pending Requests Count
        const pendingCount = await prisma.ausencia.count({
            where: { estado: 'PENDIENTE' }
        });

        // 4. Full History (Latest 50 for table)
        const history = await prisma.ausencia.findMany({
            take: 50,
            orderBy: { fechaInicio: 'desc' },
            include: {
                empleado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellidos: true,
                        rol: true
                    }
                }
            }
        });

        return NextResponse.json({
            absentToday,
            upcomingAbsences,
            pendingCount,
            history
        });

    } catch (error) {
        console.error("Error stats dashboard:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
