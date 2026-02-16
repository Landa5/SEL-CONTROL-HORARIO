import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO, differenceInMinutes, isSameDay, isWeekend, eachDayOfInterval } from 'date-fns';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { startDate, endDate, role, metrics } = body;

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Rango de fechas requerido' }, { status: 400 });
        }

        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(endDate));

        // 1. Fetch Employees (filtered by Role if provided)
        const whereRole = role && role !== 'TODOS' ? { rol: role } : {};
        const employees = await prisma.empleado.findMany({
            where: {
                activo: true,
                ...whereRole
            },
            orderBy: { apellidos: 'asc' }
        });

        // 2. Fetch Shifts for the period
        // Optimization: Fetch all shifts in range and process in memory to avoid N+1 queries
        // logic is simpler if we query shifts for all relevant employees
        const employeeIds = employees.map(e => e.id);

        const shifts = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId: { in: employeeIds },
                fecha: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                usosCamion: true
            }
        });

        // 3. Fetch Holidays
        const allHolidays = await prisma.fiestaLocal.findMany({
            where: { activa: true }
        });

        // 4. Fetch Absences
        const absences = await prisma.ausencia.findMany({
            where: {
                empleadoId: { in: employeeIds },
                estado: 'APROBADA',
                OR: [
                    { fechaInicio: { lte: end }, fechaFin: { gte: start } }
                ]
            }
        });

        // 5. Aggregate Data
        const reportData = employees.map(emp => {
            const empShifts = shifts.filter(s => s.empleadoId === emp.id);
            const empAbsences = absences.filter(a => a.empleadoId === emp.id);

            let totalWorkedMinutes = 0;
            let totalOvertimeMinutes = 0;
            let totalKm = 0;
            let totalLiter = 0;
            let daysWorked = 0;
            let punctualityScore = 0;
            let expectedMinutesTotal = 0;

            // Helper to parse "HH:MM"
            const parseTimeStr = (timeStr: string | null) => {
                if (!timeStr) return null;
                const [h, m] = timeStr.split(':').map(Number);
                return { h, m };
            };

            const calculateStandardDailyHours = () => {
                let hours = 0;
                // Simple approximation for standard hours from profile
                // ideally we duplicate the logic from the monthly report or extract to a shared util
                const morningStart = parseTimeStr(emp.horaEntradaPrevista);
                const morningEnd = parseTimeStr(emp.horaSalidaPrevista);
                const afternoonStart = parseTimeStr(emp.horaEntradaTarde);
                const afternoonEnd = parseTimeStr(emp.horaSalidaTarde);

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
                return hours > 0 ? hours : 8;
            };
            const standardDailyHours = calculateStandardDailyHours();

            // Iterate days to calculate expected vs actual
            // Note: For custom ranges spanning many months, iterating every day might be heavy if range is huge.
            // But for typical reporting (months/year), it's fine.
            const daysInterval = eachDayOfInterval({ start, end });

            daysInterval.forEach(day => {
                // Check if it's a working day
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
                const absence = empAbsences.find(a => {
                    const aStart = startOfDay(new Date(a.fechaInicio));
                    const aEnd = endOfDay(new Date(a.fechaFin));
                    return day >= aStart && day <= aEnd;
                });

                // Get Shift
                const shift = empShifts.find(s => isSameDay(new Date(s.fecha), day));

                let expectedMinutes = 0;
                if (!isWeekendDay && !isHoliday && !absence) {
                    expectedMinutes = standardDailyHours * 60;
                }
                expectedMinutesTotal += expectedMinutes;

                if (shift) {
                    daysWorked++;

                    // Basic aggregations from DB (assuming standardized via triggers or previous logic)
                    // For custom report, reusing the raw worked logic is safer if we want consistency with monthly report
                    // But iterating complete logic again here is code duplication.
                    // For this V1, we will trust strict schedule logic implies valid data or close enough approximation
                    // We will re-implement the basic net calculation for accuracy

                    const startShift = new Date(shift.horaEntrada);
                    const endShift = shift.horaSalida ? new Date(shift.horaSalida) : new Date(); // approximate if running

                    // Strict Start Logic
                    let effectiveStart = startShift;
                    if (emp.horaEntradaPrevista) {
                        const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                        const expectedStart = new Date(day);
                        expectedStart.setHours(h, m, 0, 0);
                        if (startShift < expectedStart) effectiveStart = expectedStart;
                    }

                    // Net Minutes
                    let minutes = differenceInMinutes(endShift, effectiveStart);

                    // Lunch Deduction
                    if (emp.horaSalidaPrevista && emp.horaEntradaTarde) {
                        const [hEnd, mEnd] = emp.horaSalidaPrevista.split(':').map(Number);
                        const [hStart, mStart] = emp.horaEntradaTarde.split(':').map(Number);
                        const lunchStart = new Date(startShift); lunchStart.setHours(hEnd, mEnd, 0, 0);
                        const lunchEnd = new Date(startShift); lunchEnd.setHours(hStart, mStart, 0, 0);

                        if (effectiveStart < lunchStart && endShift > lunchEnd) {
                            const breakMinutes = differenceInMinutes(lunchEnd, lunchStart);
                            if (breakMinutes > 0) minutes -= breakMinutes;
                        }
                    }

                    minutes = Math.max(0, minutes);
                    totalWorkedMinutes += minutes;

                    const overtime = Math.max(0, minutes - expectedMinutes);
                    totalOvertimeMinutes += overtime;

                    // Calculate KM from Truck Uses
                    const dailyKm = shift.usosCamion?.reduce((acc, u) => {
                        const dist = (u.kmFinal || u.kmInicial) - u.kmInicial;
                        return acc + Math.max(0, dist);
                    }, 0) || 0;
                    totalKm += dailyKm;

                    // Calculate Liters
                    totalLiter += shift.usosCamion?.reduce((acc, u) => acc + (u.litrosRepostados || 0), 0) || 0;

                    // Punctuality
                    if (expectedMinutes > 0 && emp.horaEntradaPrevista) {
                        const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                        // shift actual start vs expected
                        // simple minutes comparison
                        const shiftH = startShift.getHours();
                        const shiftM = startShift.getMinutes();
                        const shiftMinOfDay = shiftH * 60 + shiftM;
                        const expMinOfDay = h * 60 + m;
                        punctualityScore += (shiftMinOfDay - expMinOfDay);
                    }
                }
            });

            return {
                id: emp.id,
                nombre: emp.nombre,
                apellidos: emp.apellidos,
                rol: emp.rol,
                totalHoras: Number((totalWorkedMinutes / 60).toFixed(2)),
                totalExtras: Number((totalOvertimeMinutes / 60).toFixed(2)),
                totalKm,
                totalLitros: totalLiter,
                diasTrabajados: daysWorked,
                puntualidadMedia: daysWorked > 0 ? Math.round(punctualityScore / daysWorked) : 0
            };
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error("Error generating custom report:", error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
