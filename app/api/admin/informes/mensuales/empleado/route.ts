import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, format, differenceInMinutes, eachDayOfInterval, isSameDay, isWeekend, startOfDay, addDays } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = endOfMonth(startDate);

        // 1. Fetch Employee with Schedule
        const employee = await prisma.empleado.findUnique({
            where: { id: parseInt(employeeId) },
            // @ts-ignore
            select: {
                id: true, nombre: true, rol: true,
                horaEntradaPrevista: true, horaSalidaPrevista: true,
                horaEntradaTarde: true, horaSalidaTarde: true
            }
        });

        if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        const emp = employee as any;

        // 2. Fetch Shifts
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

        // 3. Fetch Holidays (FiestaLocal)
        // Fetch all active holidays and filter in memory for simplicity regarding "esAnual"
        const allHolidays = await prisma.fiestaLocal.findMany({
            where: { activa: true }
        });

        // 4. Fetch Approved Absences overlapping the month
        const absences = await prisma.ausencia.findMany({
            where: {
                empleadoId: parseInt(employeeId),
                estado: 'APROBADA',
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ]
            }
        });

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

        // Calculate standard expected daily hours (ignoring holidays/absences)
        const calculateStandardDailyHours = () => {
            let hours = 0;
            if (morningStart && morningEnd) {
                const s = morningStart.h * 60 + morningStart.m;
                const e = morningEnd.h * 60 + morningEnd.m;
                if (e > s) hours += (e - s) / 60;
            }
            if (afternoonStart && afternoonEnd) {
                const s = afternoonStart.h * 60 + afternoonStart.m;
                const e = afternoonEnd.h * 60 + afternoonEnd.m;
                if (e > s) hours += (e - s) / 60;
            }
            return hours > 0 ? hours : 8; // Default 8 if no config
        };
        const standardDailyHours = calculateStandardDailyHours();


        // Iterate through EVERY day of the month
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        let totalWorkedMinutes = 0;
        let totalOvertimeMinutes = 0;
        let punctualityScore = 0;
        let daysWorkedCount = 0;
        let totalExpectedMinutes = 0;

        const shiftDetails = days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');

            // Check flags
            const isWeekendDay = isWeekend(day);

            // Check Holiday
            const isHoliday = allHolidays.some(h => {
                const hDate = new Date(h.fecha);
                if (h.esAnual) {
                    return hDate.getDate() === day.getDate() && hDate.getMonth() === day.getMonth();
                }
                return isSameDay(hDate, day);
            });

            // Check Absence
            const absence = absences.find(a => {
                const start = startOfDay(new Date(a.fechaInicio));
                const end = endOfDay(new Date(a.fechaFin));
                return day >= start && day <= end;
            });

            // Determine Expected Hours for this specific day
            let expectedMinutes = 0;
            let dayType = 'NORMAL'; // 'NORMAL', 'WEEKEND', 'HOLIDAY', 'ABSENCE', 'VACATION'

            if (isWeekendDay) {
                dayType = 'WEEKEND';
            } else if (isHoliday) {
                dayType = 'HOLIDAY';
            } else if (absence) {
                dayType = absence.tipo || 'ABSENCE';
            } else {
                expectedMinutes = standardDailyHours * 60;
            }

            // Find Shift
            // Note: shifts from DB are UTC/Local. We match by comparing formatted strings or isSameDay.
            // Assumption: shift.fecha is stored correctly as the shift day.
            const shift = shifts.find(s => isSameDay(new Date(s.fecha), day));

            let workedMinutes = 0;
            let startStr = '--:--';
            let endStr = '--:--';
            let punctualityForDay = 0;

            if (shift) {
                daysWorkedCount++;
                const start = new Date(shift.horaEntrada);
                const end = shift.horaSalida ? new Date(shift.horaSalida) : null;

                startStr = format(start, 'HH:mm');
                endStr = end ? format(end, 'HH:mm') : 'En curso';

                if (shift.totalHoras) {
                    workedMinutes = shift.totalHoras * 60;
                } else {
                    const refEnd = end || new Date(); // If ongoing, calc up to now
                    workedMinutes = differenceInMinutes(refEnd, start);
                }

                // Punctuality (Only if expected to work)
                if (expectedMinutes > 0 && emp.horaEntradaPrevista) {
                    const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                    const expectedStart = new Date(day); // Use the current loop day
                    expectedStart.setHours(h, m, 0, 0);

                    // Compare shift start with expected start
                    // We need to match day components if shift.horaEntrada is precise
                    // Usually punctuality is just time difference

                    // Fix for potential date mismatches: Set shift start to same day as expectedStart for comparing TIME ONLY
                    const shiftStartAsTime = new Date(expectedStart);
                    shiftStartAsTime.setHours(start.getHours(), start.getMinutes(), 0, 0);

                    punctualityForDay = differenceInMinutes(shiftStartAsTime, expectedStart);
                    punctualityScore += punctualityForDay;
                }
            }

            // If they worked on a weekend/holiday/absence, expectedMinutes for OVERTIME calculation
            // is debatable. Usually: Overtime = Worked - Expected.
            // If Expected is 0, then ALL worked is Overtime. OK.

            const overtime = Math.max(0, workedMinutes - expectedMinutes);

            totalWorkedMinutes += workedMinutes;
            totalOvertimeMinutes += overtime;
            totalExpectedMinutes += expectedMinutes;

            return {
                id: shift?.id,
                date: dateStr,
                dayType,
                start: startStr,
                end: endStr,
                workedMinutes,
                overtimeMinutes: overtime,
                punctuality: punctualityForDay,
                status: shift?.estado || (absence ? absence.estado : isWeekendDay ? 'WEEKEND' : 'MISSING')
            };
        });

        // Summary
        const stats = {
            employee,
            period: { month, year },
            summary: {
                totalHours: totalWorkedMinutes / 60,
                totalOvertime: totalOvertimeMinutes / 60,
                daysWorked: daysWorkedCount, // Days physically present
                avgPunctuality: daysWorkedCount > 0 ? Math.round(punctualityScore / daysWorkedCount) : 0,
                expectedHours: totalExpectedMinutes / 60
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
function endOfDay(date: Date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}
