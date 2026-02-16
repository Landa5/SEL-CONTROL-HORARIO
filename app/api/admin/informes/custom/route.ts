import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO, differenceInMinutes, isSameDay, isWeekend, eachDayOfInterval, format } from 'date-fns';

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
            // Iterate days to calculate expected vs actual and store details
            const dailyDetails = eachDayOfInterval({ start, end }).map(day => {
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

                let workedMinutes = 0;
                let overtime = 0;
                let punctuality = 0;
                let dailyKm = 0;
                let dailyLiter = 0;

                if (shift) {
                    const startShift = new Date(shift.horaEntrada);
                    const endShift = shift.horaSalida ? new Date(shift.horaSalida) : new Date();

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

                    workedMinutes = Math.max(0, minutes);
                    overtime = Math.max(0, workedMinutes - expectedMinutes);

                    // Punctuality
                    if (expectedMinutes > 0 && emp.horaEntradaPrevista) {
                        const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                        const shiftMinOfDay = startShift.getHours() * 60 + startShift.getMinutes();
                        const expMinOfDay = h * 60 + m;
                        punctuality = shiftMinOfDay - expMinOfDay;
                    }

                    // KM & Fuel
                    dailyKm = shift.usosCamion?.reduce((acc, u) => {
                        const dist = (u.kmFinal || u.kmInicial) - u.kmInicial;
                        return acc + Math.max(0, dist);
                    }, 0) || 0;

                    dailyLiter = shift.usosCamion?.reduce((acc, u) => acc + (u.litrosRepostados || 0), 0) || 0;
                }

                return {
                    date: format(day, 'yyyy-MM-dd'),
                    isWeekend: isWeekendDay,
                    isHoliday,
                    absenceType: absence?.tipo,
                    hasShift: !!shift,
                    start: shift ? format(new Date(shift.horaEntrada), 'HH:mm') : '-',
                    end: shift?.horaSalida ? format(new Date(shift.horaSalida), 'HH:mm') : '-',
                    workedMinutes,
                    overtime,
                    punctuality,
                    km: dailyKm,
                    liters: dailyLiter,
                    expectedMinutes
                };
            });

            // Aggregate results
            const totalWorkedMinutes = dailyDetails.reduce((acc, d) => acc + d.workedMinutes, 0);
            const totalOvertimeMinutes = dailyDetails.reduce((acc, d) => acc + d.overtime, 0);
            const totalKm = dailyDetails.reduce((acc, d) => acc + d.km, 0);
            const totalLiter = dailyDetails.reduce((acc, d) => acc + d.liters, 0);
            const daysWorked = dailyDetails.filter(d => d.hasShift).length;

            // Average Punctuality (only days worked and expected to work)
            const punctualityDays = dailyDetails.filter(d => d.hasShift && d.expectedMinutes > 0);
            const punctualityScoreTotal = punctualityDays.reduce((acc, d) => acc + d.punctuality, 0);
            const punctualityMedia = punctualityDays.length > 0 ? Math.round(punctualityScoreTotal / punctualityDays.length) : 0;

            // Days Late (> 5 min tolerance)
            const diasRetraso = dailyDetails.filter(d => d.hasShift && d.expectedMinutes > 0 && d.punctuality > 5).length;

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
                diasRetraso,
                puntualidadMedia: punctualityMedia,
                detalles: dailyDetails
            };
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error("Error generating custom report:", error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
