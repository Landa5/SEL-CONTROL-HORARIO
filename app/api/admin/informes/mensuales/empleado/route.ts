import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, format, differenceInMinutes, addMinutes } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    try {
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(startDate);

        // Fetch Employee with Schedule
        const employee = await prisma.empleado.findUnique({
            where: { id: parseInt(employeeId) },
            select: {
                id: true, nombre: true, rol: true,
                horaEntradaPrevista: true, horaSalidaPrevista: true
            }
        });

        if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

        // Fetch Shifts
        const shifts = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId: parseInt(employeeId),
                fecha: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: { fecha: 'asc' },
            include: {
                usosCamion: true
            }
        });

        // Calculate Stats
        let totalWorkedMinutes = 0;
        let totalOvertimeMinutes = 0;
        let punctualityScore = 0; // Negative = Early, Positive = Late
        let daysWorked = shifts.length;
        let shiftDetails: any[] = [];

        // Parse expected schedule
        const expectedStart = employee.horaEntradaPrevista ? parseTime(employee.horaEntradaPrevista) : null;
        const expectedEnd = employee.horaSalidaPrevista ? parseTime(employee.horaSalidaPrevista) : null;

        let expectedMinutesPerDay = 480; // Default 8h
        if (expectedStart && expectedEnd) {
            expectedMinutesPerDay = differenceInMinutes(expectedEnd, expectedStart);
            // Subtract typical hour break if shift > 6h? Keeping simple for now.
        }

        shifts.forEach(shift => {
            const dateStr = format(shift.fecha, 'yyyy-MM-dd');
            const start = new Date(shift.horaEntrada);
            const end = shift.horaSalida ? new Date(shift.horaSalida) : null;

            let workedMinutes = 0;
            if (shift.totalHoras) {
                workedMinutes = shift.totalHoras * 60;
            } else if (end) {
                workedMinutes = differenceInMinutes(end, start);
            }

            // Punctuality Check (Only if defined)
            let punctualityDiff = 0;
            if (expectedStart) {
                // Construct expected time for THIS day
                const expectedForDay = setTimeOnDate(shift.fecha, expectedStart);
                punctualityDiff = differenceInMinutes(start, expectedForDay);
                punctualityScore += punctualityDiff;
            }

            // Overtime
            const overtime = Math.max(0, workedMinutes - expectedMinutesPerDay);

            totalWorkedMinutes += workedMinutes;
            totalOvertimeMinutes += overtime;

            shiftDetails.push({
                id: shift.id,
                date: dateStr,
                start: format(start, 'HH:mm'),
                end: end ? format(end, 'HH:mm') : 'En curso',
                workedMinutes,
                overtimeMinutes: overtime,
                punctuality: punctualityDiff,
                status: shift.estado
            });
        });

        const stats = {
            employee,
            period: { month, year },
            summary: {
                totalHours: totalWorkedMinutes / 60,
                totalOvertime: totalOvertimeMinutes / 60,
                daysWorked,
                avgPunctuality: daysWorked > 0 ? Math.round(punctualityScore / daysWorked) : 0,
                expectedHours: (daysWorked * expectedMinutesPerDay) / 60
            },
            shifts: shiftDetails
        };

        return NextResponse.json(stats);
    } catch (error) {
        console.error("Error fetching employee monthly report:", error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

// Helpers
function parseTime(timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
}

function setTimeOnDate(date: Date, timeRef: Date) {
    const d = new Date(date);
    d.setHours(timeRef.getHours(), timeRef.getMinutes(), 0, 0);
    return d;
}
