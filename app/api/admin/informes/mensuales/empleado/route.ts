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

            // ---------------------------------------------------------
            // Fix UTC Display & Lunch Deduction Logic
            // ---------------------------------------------------------

            // Helper: Format Time in Madrid Zone
            const formatTime = (date: Date) => {
                // We manually adjust for Madrid (UTC+1/UTC+2) to ensure consistency regardless of Server Timezone
                // Since this is a simple display, using toLocaleString is robust enough
                return date.toLocaleTimeString('es-ES', {
                    timeZone: 'Europe/Madrid',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            };

            const calculateNetWorkedMinutes = (start: Date, end: Date) => {
                let total = differenceInMinutes(end, start);

                // Deduct Lunch Break if configured and shift spans across it
                if (emp.horaSalidaPrevista && emp.horaEntradaTarde) {
                    const [hEnd, mEnd] = emp.horaSalidaPrevista.split(':').map(Number);
                    const [hStart, mStart] = emp.horaEntradaTarde.split(':').map(Number);

                    const lunchStart = new Date(start);
                    lunchStart.setHours(hEnd, mEnd, 0, 0);

                    const lunchEnd = new Date(start);
                    lunchEnd.setHours(hStart, mStart, 0, 0);

                    // Only deduct if shift starts BEFORE lunch and ends AFTER lunch starts
                    // (and strictly if it covers the break roughly)
                    if (start < lunchStart && end > lunchEnd) {
                        const breakMinutes = differenceInMinutes(lunchEnd, lunchStart);
                        if (breakMinutes > 0) {
                            total -= breakMinutes;
                        }
                    }
                }
                return Math.max(0, total);
            };

            // Find ALL Shifts for this day (may have morning + afternoon)
            // BUG FIX: Previously used shifts.find() which only returned the FIRST shift,
            // ignoring a second shift (e.g., afternoon). Now we use filter() to get ALL.
            const dayShifts = shifts.filter(s => isSameDay(new Date(s.fecha), day));

            let workedMinutes = 0;
            let startStr = '--:--';
            let endStr = '--:--';
            let punctualityForDay = 0;
            let kmDia = 0;
            let viajesDia = 0;
            let descargasDia = 0;

            if (dayShifts.length > 0) {
                daysWorkedCount++;

                // Sort shifts by entry time to get the correct order
                dayShifts.sort((a, b) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());

                // Display: first entry → last exit
                const firstShift = dayShifts[0];
                const lastShift = dayShifts[dayShifts.length - 1];

                startStr = formatTime(new Date(firstShift.horaEntrada));
                endStr = lastShift.horaSalida ? formatTime(new Date(lastShift.horaSalida)) : 'En curso';

                // Accumulate worked minutes from ALL shifts
                for (const shift of dayShifts) {
                    const shiftStart = new Date(shift.horaEntrada);
                    const shiftEnd = shift.horaSalida ? new Date(shift.horaSalida) : new Date();

                    // Strict Schedule Logic: Count hours from Schedule Start if arrived early (only for first shift)
                    let effectiveStart = shiftStart;
                    if (shift === firstShift && emp.horaEntradaPrevista) {
                        const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                        const expectedStart = new Date(day);
                        expectedStart.setHours(h, m, 0, 0);
                        if (shiftStart < expectedStart) {
                            effectiveStart = expectedStart;
                        }
                    }

                    // For individual shifts, we do NOT deduct lunch (each shift is already separated)
                    const shiftMinutes = differenceInMinutes(shiftEnd, effectiveStart);
                    workedMinutes += Math.max(0, shiftMinutes);

                    // Accumulate truck usage from ALL shifts
                    if (shift.usosCamion && shift.usosCamion.length > 0) {
                        shift.usosCamion.forEach((u: any) => {
                            kmDia += (u.kmRecorridos || 0);
                            viajesDia += (u.viajesCount || 0);
                            descargasDia += (u.descargasCount || 0);
                        });
                    }
                }

                // If there's only ONE shift that spans the whole day (no split),
                // apply the lunch deduction as before
                if (dayShifts.length === 1) {
                    const singleStart = new Date(firstShift.horaEntrada);
                    const singleEnd = firstShift.horaSalida ? new Date(firstShift.horaSalida) : new Date();

                    let effectiveStart = singleStart;
                    if (emp.horaEntradaPrevista) {
                        const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                        const expectedStart = new Date(day);
                        expectedStart.setHours(h, m, 0, 0);
                        if (singleStart < expectedStart) effectiveStart = expectedStart;
                    }

                    // Recalculate with lunch deduction for single continuous shift
                    workedMinutes = calculateNetWorkedMinutes(effectiveStart, singleEnd);
                }

                // Punctuality (based on first shift entry vs expected schedule)
                if (expectedMinutes > 0 && emp.horaEntradaPrevista) {
                    const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);

                    const [sh, sm] = startStr.split(':').map(Number);
                    const shiftMinutes = sh * 60 + sm;
                    const expectedMinutes = h * 60 + m;

                    punctualityForDay = shiftMinutes - expectedMinutes;
                    punctualityScore += punctualityForDay;
                }
            }

            // If they worked on a weekend/holiday/absence, expectedMinutes for OVERTIME calculation
            // is debatable. Usually: Overtime = Worked - Expected.
            // If Expected is 0, then ALL worked is Overtime. OK.
            // But if they just worked, we count it.

            const overtime = Math.max(0, workedMinutes - expectedMinutes);

            totalWorkedMinutes += workedMinutes;
            totalOvertimeMinutes += overtime;
            totalExpectedMinutes += expectedMinutes;

            return {
                id: dayShifts[0]?.id,
                date: dateStr,
                dayType,
                start: startStr,
                end: endStr,
                workedMinutes,
                overtimeMinutes: overtime,
                punctuality: punctualityForDay,
                km: kmDia,
                viajes: viajesDia,
                descargas: descargasDia,
                shiftCount: dayShifts.length,
                allShiftTimes: dayShifts.length > 1
                    ? dayShifts.map(s => {
                        const sStart = formatTime(new Date(s.horaEntrada));
                        const sEnd = s.horaSalida ? formatTime(new Date(s.horaSalida)) : 'En curso';
                        return `${sStart}-${sEnd}`;
                    }).join(', ')
                    : undefined,
                status: dayShifts[0]?.estado || (absence ? absence.estado : isWeekendDay ? 'WEEKEND' : 'MISSING')
            };
        });

        // ... (previous logic for stats)

        // 5. Fetch Tariffs to Calculate Incentives
        // We need both GLOBAL tariffs (empleadoId: null) and SPECIFIC tariffs (empleadoId: this employee)
        // Specific generally overrides global. But simpler logic: Fetch all matching this employee OR global, then map.
        const activeTariffs = await prisma.tarifaNomina.findMany({
            where: {
                activo: true,
                OR: [
                    { empleadoId: parseInt(employeeId) },
                    { empleadoId: null } // Global
                ]
            },
            include: {
                concepto: true
            }
        });

        // Resolve active tariff per concept (prefer active specific over global)
        const relevantTariffs = new Map<string, number>(); // code -> value
        activeTariffs.forEach(t => {
            const code = t.concepto.codigo;
            // If specific, always set. If global, set only if not set (or overwrite if we processed global first? No, we process list.)
            // Logic: Store specific separate from global, then merge.
        });

        const globalTariffs: Record<string, number> = {};
        const specificTariffs: Record<string, number> = {};

        activeTariffs.forEach(t => {
            const code = t.concepto.codigo;
            if (t.empleadoId) {
                specificTariffs[code] = t.valor;
            } else {
                globalTariffs[code] = t.valor;
            }
        });

        // Merge: Specific overrides Global
        const tariffs = { ...globalTariffs, ...specificTariffs };

        // 6. Calculate ALL totals from UsosCamion
        let verifiedKm = 0;
        let verifiedDescargas = 0;
        let verifiedViajes = 0;
        shifts.forEach(s => {
            if (s.usosCamion && s.usosCamion.length > 0) {
                s.usosCamion.forEach((u: any) => {
                    verifiedKm += (u.kmRecorridos || 0);
                    verifiedDescargas += (u.descargasCount || 0);
                    verifiedViajes += (u.viajesCount || 0);
                });
            }
        });

        // Count vacation and absence days from absences
        let diasVacaciones = 0;
        let diasAusencia = 0;
        absences.forEach(a => {
            const aStart = new Date(a.fechaInicio) < startDate ? startDate : new Date(a.fechaInicio);
            const aEnd = new Date(a.fechaFin) > endDate ? endDate : new Date(a.fechaFin);
            const diff = Math.ceil((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const days = Math.max(0, diff);
            if (a.tipo === 'VACACIONES') {
                diasVacaciones += days;
            } else {
                diasAusencia += days;
            }
        });

        // Horas extra
        const horasExtra = totalOvertimeMinutes / 60;

        // 7. Build Incentives array (ALL concepts)
        const incentives: any[] = [];

        // --- A. PRECIO_KM ---
        const pKm = tariffs['PRECIO_KM'] || 0;
        incentives.push({
            codigo: 'PRECIO_KM',
            nombre: 'Kilometraje',
            cantidad: verifiedKm,
            precio: pKm,
            total: verifiedKm * pKm,
            tipo: 'VARIABLE'
        });

        // --- B. DESCARGAS ---
        const pDescarga = tariffs['PRECIO_DESCARGA'] || 0;
        incentives.push({
            codigo: 'PRECIO_DESCARGA',
            nombre: 'Descargas',
            cantidad: verifiedDescargas,
            precio: pDescarga,
            total: verifiedDescargas * pDescarga,
            tipo: 'VARIABLE'
        });

        // --- C. VIAJES ---
        const pViaje = tariffs['PRECIO_VIAJE'] || 0;
        incentives.push({
            codigo: 'PRECIO_VIAJE',
            nombre: 'Viajes',
            cantidad: verifiedViajes,
            precio: pViaje,
            total: verifiedViajes * pViaje,
            tipo: 'VARIABLE'
        });

        // --- D. HORAS EXTRA ---
        const pHoraExtra = tariffs['HORAS_EXTRA'] || 0;
        incentives.push({
            codigo: 'HORAS_EXTRA',
            nombre: 'Horas Extra',
            cantidad: parseFloat(horasExtra.toFixed(2)),
            precio: pHoraExtra,
            total: parseFloat((horasExtra * pHoraExtra).toFixed(2)),
            tipo: 'VARIABLE'
        });

        // --- E. VACACIONES ---
        incentives.push({
            codigo: 'VACACIONES',
            nombre: 'Vacaciones',
            cantidad: diasVacaciones,
            precio: 0,
            total: 0,
            tipo: 'INFO',
            meta: diasVacaciones > 0 ? `${diasVacaciones} día(s) de vacaciones` : 'Sin vacaciones'
        });

        // --- F. AUSENCIAS ---
        if (diasAusencia > 0) {
            incentives.push({
                codigo: 'AUSENCIAS',
                nombre: 'Ausencias / Bajas',
                cantidad: diasAusencia,
                precio: 0,
                total: 0,
                tipo: 'INFO',
                meta: `${diasAusencia} día(s)`
            });
        }

        // --- G. HORAS TRABAJADAS (referencia) ---
        incentives.push({
            codigo: 'HORAS_TRABAJADAS',
            nombre: 'Horas Trabajadas',
            cantidad: parseFloat((totalWorkedMinutes / 60).toFixed(2)),
            precio: 0,
            total: 0,
            tipo: 'INFO',
            meta: `de ${(totalExpectedMinutes / 60).toFixed(1)}h esperadas`
        });

        // --- H. PLUS_ANTIGUEDAD ---
        if (tariffs['PLUS_ANTIGUEDAD']) {
            incentives.push({
                codigo: 'PLUS_ANTIGUEDAD',
                nombre: 'Plus Antigüedad',
                cantidad: 1,
                precio: tariffs['PLUS_ANTIGUEDAD'],
                total: tariffs['PLUS_ANTIGUEDAD'],
                tipo: 'FIJO'
            });
        }

        // --- I. BONUS_SEGURIDAD ---
        if (tariffs['BONUS_SEGURIDAD']) {
            incentives.push({
                codigo: 'BONUS_SEGURIDAD',
                nombre: 'Prima Seguridad',
                cantidad: 1,
                precio: tariffs['BONUS_SEGURIDAD'],
                total: tariffs['BONUS_SEGURIDAD'],
                tipo: 'BONUS'
            });
        }

        // --- J. PLUS_DISPONIBILIDAD ---
        if (tariffs['PLUS_DISPONIBILIDAD']) {
            incentives.push({
                codigo: 'PLUS_DISPONIBILIDAD',
                nombre: 'Plus Disponibilidad',
                cantidad: 1,
                precio: tariffs['PLUS_DISPONIBILIDAD'],
                total: tariffs['PLUS_DISPONIBILIDAD'],
                tipo: 'FIJO'
            });
        }

        // --- K. BONUS_PUNTUALIDAD ---
        const isPunctual = (daysWorkedCount > 0 && (punctualityScore / daysWorkedCount) <= 15);
        if (tariffs['BONUS_PUNTUALIDAD']) {
            incentives.push({
                codigo: 'BONUS_PUNTUALIDAD',
                nombre: 'Prima Puntualidad',
                cantidad: isPunctual ? 1 : 0,
                precio: tariffs['BONUS_PUNTUALIDAD'],
                total: isPunctual ? tariffs['BONUS_PUNTUALIDAD'] : 0,
                tipo: 'BONUS',
                meta: isPunctual ? 'Objetivo Cumplido' : 'No cumplido (>15m media)'
            });
        }

        // --- L. BONUS_CONSUMO ---
        if (tariffs['BONUS_CONSUMO']) {
            incentives.push({
                codigo: 'BONUS_CONSUMO',
                nombre: 'Conducción Eficiente',
                cantidad: 1,
                precio: tariffs['BONUS_CONSUMO'],
                total: tariffs['BONUS_CONSUMO'],
                tipo: 'BONUS'
            });
        }

        // --- M. DIETAS ---
        if (tariffs['DIETA_NACION']) {
            incentives.push({
                codigo: 'DIETA_NACION',
                nombre: 'Dietas (Estimado)',
                cantidad: daysWorkedCount,
                precio: tariffs['DIETA_NACION'],
                total: daysWorkedCount * tariffs['DIETA_NACION'],
                tipo: 'VARIABLE'
            });
        }

        // Summary
        const stats = {
            employee,
            period: { month, year },
            summary: {
                totalHours: totalWorkedMinutes / 60,
                totalOvertime: totalOvertimeMinutes / 60,
                daysWorked: daysWorkedCount,
                avgPunctuality: daysWorkedCount > 0 ? Math.round(punctualityScore / daysWorkedCount) : 0,
                expectedHours: totalExpectedMinutes / 60,
                totalKm: verifiedKm,
                totalDescargas: verifiedDescargas,
                totalViajes: verifiedViajes,
                diasVacaciones,
                diasAusencia
            },
            shifts: shiftDetails,
            incentives: incentives,
            incentivesTotal: incentives.reduce((acc, i) => acc + i.total, 0)
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
