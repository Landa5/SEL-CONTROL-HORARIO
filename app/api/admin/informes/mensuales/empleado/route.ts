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
                horaEntradaPrevista: true, horaSalidaPrevista: true,
                horaEntradaTarde: true, horaSalidaTarde: true
            }
        });

        if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });

        // Cast to any to avoid TS errors with new fields if client didn't update
        const emp = employee as any;

        // Helper to parse "HH:MM"
        const parseTimeStr = (timeStr: string | null) => {
            if (!timeStr) return null;
            const [h, m] = timeStr.split(':').map(Number);
            return { h, m };
        };

        const morningStart = parseTimeStr(emp.horaEntradaPrevista);
        const morningEnd = parseTimeStr(emp.horaSalidaPrevista);
        const afternoonStart = parseTimeStr(emp.horaEntradaTarde);
        const afternoonEnd = parseTimeStr(emp.horaSalidaTarde);

        // Calculate expected daily hours
        let expectedDailyHours = 0;

        // Morning shift calculation
        if (morningStart && morningEnd) {
            const startMinutes = morningStart.h * 60 + morningStart.m;
            const endMinutes = morningEnd.h * 60 + morningEnd.m;
            if (endMinutes > startMinutes) {
                expectedDailyHours += (endMinutes - startMinutes) / 60;
            }
        }

        // Afternoon shift calculation
        if (afternoonStart && afternoonEnd) {
            const startMinutes = afternoonStart.h * 60 + afternoonStart.m;
            const endMinutes = afternoonEnd.h * 60 + afternoonEnd.m;
            if (endMinutes > startMinutes) {
                expectedDailyHours += (endMinutes - startMinutes) / 60;
            }
        }

        // Default to 8 hours if no schedule is defined/valid
        if (expectedDailyHours === 0) expectedDailyHours = 8;

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

        let expectedMinutesPerDay = expectedDailyHours * 60;

        // Helper to set time on date
        const setTimeOnDate = (date: Date, timeStr: string) => {
            const [h, m] = timeStr.split(':').map(Number);
            const newDate = new Date(date);
            newDate.setHours(h, m, 0, 0);
            return newDate;
        };

        shifts.forEach(shift => {
            const dateStr = format(shift.fecha, 'yyyy-MM-dd');
            const start = new Date(shift.horaEntrada);
            const end = shift.horaSalida ? new Date(shift.horaSalida) : new Date(); // Or handle active shifts differnetly
            const durationMs = end.getTime() - start.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);

            let workedMinutes = 0;
            if (shift.totalHoras) {
                // Use stored total if available
                workedMinutes = shift.totalHoras * 60;
            } else {
                workedMinutes = differenceInMinutes(end, start);
            }

            let dayType = 'NORMAL';
            if ([0, 6].includes(start.getDay())) dayType = 'WEEKEND';

            // Punctuality Check: Compare actual start with EXPECTED start 
            // Logic: negative = early, positive = late
            let punctualityDiff = 0;
            if (emp.horaEntradaPrevista) {
                // Construct expected time for THIS day
                const expectedForDay = setTimeOnDate(shift.fecha, emp.horaEntradaPrevista);
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
