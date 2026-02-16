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

                startStr = formatTime(start);
                endStr = end ? formatTime(end) : 'En curso';

                // Strict Schedule Logic: Count hours from Schedule Start if arrived early
                let effectiveStart = start;
                if (emp.horaEntradaPrevista) {
                    const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                    const expectedStart = new Date(day);
                    expectedStart.setHours(h, m, 0, 0);

                    // If arricved BEFORE schedule, count from schedule
                    if (start < expectedStart) {
                        effectiveStart = expectedStart;
                    }
                }

                // Always recalculate to ensure lunch break deduction is applied. 
                // We ignore DB totalHoras because it might be inflated (missing the deduction).
                const refEnd = end || new Date();
                workedMinutes = calculateNetWorkedMinutes(effectiveStart, refEnd);

                // Punctuality (Only if expected to work)
                if (expectedMinutes > 0 && emp.horaEntradaPrevista) {
                    const [h, m] = emp.horaEntradaPrevista.split(':').map(Number);
                    const expectedStart = new Date(day);
                    expectedStart.setHours(h, m, 0, 0);

                    // Compare shift start with expected start
                    // We interpret the "expected start" as being in local time (Madrid) relative to the day
                    // But 'start' is a UTC timestamp.
                    // To compare correctly, we should get the "local time minutes" of the shift

                    // Simple approach: parse the HH:mm we just formatted
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

        // 6. Calculate Incentives
        // Variables
        // Calculated below from UsosCamion

        // Wait, 'jornadaLaboral' in schema has 'kmRecorridos'? NO.
        // It has relations 'usosCamion'.
        // Let's recalculate KM from UsosCamion
        let verifiedKm = 0;
        shifts.forEach(s => {
            if (s.usosCamion && s.usosCamion.length > 0) {
                s.usosCamion.forEach((u: any) => verifiedKm += (u.kmRecorridos || 0));
            }
        });

        // Trips / Downloads logic? 
        // We lack a direct "Viajes" field in JornadaLaboral but let's assume specific logic or placeholders.
        // For now, we'll assume 0 if not tracked, or try to infer.
        // 'Viajes' usually in 'RegistroViaje' but that table might not be linked here directly.
        // Simplification: We will only calculate what we have data for: KM, Punctuality, etc.

        const incentives = [];

        // --- A. PRECIO_KM ---
        if (tariffs['PRECIO_KM']) {
            incentives.push({
                codigo: 'PRECIO_KM',
                nombre: 'Kilometraje',
                cantidad: verifiedKm,
                precio: tariffs['PRECIO_KM'],
                total: verifiedKm * tariffs['PRECIO_KM'],
                tipo: 'VARIABLE'
            });
        }

        // --- B. PLUS_ANTIGUEDAD ---
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

        // --- C. BONUS_SEGURIDAD ---
        // Logic: active unless there is an "Incidencia" or "Accidente"? 
        // We don't have that data fully linked yet. Assume 100% for estimation.
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

        // --- D. PLUS_DISPONIBILIDAD ---
        if (tariffs['PLUS_DISPONIBILIDAD']) {
            incentives.push({
                codigo: 'PLUS_DISPONIBILIDAD',
                nombre: 'Plus Disponibilidad',
                cantidad: 1,
                precio: tariffs['PLUS_DISPONIBILIDAD'],
                total: tariffs['PLUS_DISPONIBILIDAD'], // Could be daily? Usually monthly fixed.
                tipo: 'FIJO'
            });
        }

        // --- E. BONUS_PUNTUALIDAD ---
        // Logic: avgPunctuality <= 5 mins late? 
        // Let's say if avgPunctuality <= 5 (meaning late by 5 mins or less, or early)
        const isPunctual = (daysWorkedCount > 0 && (punctualityScore / daysWorkedCount) <= 15); // 15 min courtesy?
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

        // --- F. BONUS_CONSUMO (Eficiente) ---
        // If we had consumption data...
        // Placeholder
        if (tariffs['BONUS_CONSUMO']) {
            incentives.push({
                codigo: 'BONUS_CONSUMO',
                nombre: 'Conducción Eficiente',
                cantidad: 1, // Assume OK
                precio: tariffs['BONUS_CONSUMO'],
                total: tariffs['BONUS_CONSUMO'],
                tipo: 'BONUS'
            });
        }

        // --- G. DIETAS ---
        // If shifts have "Dietas" flag?
        // Let's assume Dietas = Days Worked * Price (simple approach)
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
                daysWorked: daysWorkedCount, // Days physically present
                avgPunctuality: daysWorkedCount > 0 ? Math.round(punctualityScore / daysWorkedCount) : 0,
                expectedHours: totalExpectedMinutes / 60,
                totalKm: verifiedKm
            },
            shifts: shiftDetails,
            incentives: incentives, // NEW FIELD
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
