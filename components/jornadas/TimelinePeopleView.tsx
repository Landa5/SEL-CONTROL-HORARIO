'use client';

import React from 'react';
import { format, differenceInMinutes, parseISO, startOfDay, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

interface TimelinePeopleViewProps {
    jornadas: any[];
    date: string;
    employees?: any[]; // Optional for backward compatibility, but should be passed
}

export default function TimelinePeopleView({ jornadas, date, employees = [] }: TimelinePeopleViewProps) {
    // 1. GROUPING & NORMALIZATION (Strict Algorithm)
    const employeeData: Record<string, {
        employee: any,
        role: string,
        shifts: { start: Date, end: Date, original: any }[]
    }> = {};

    // Helper to get role with fallback
    const getRole = (emp: any) => emp.rol || 'SIN ROL';

    // A. Initialize with all employees if available to ensure everyone is shown even if no data
    if (employees.length > 0) {
        employees.forEach(emp => {
            const strId = String(emp.id);
            employeeData[strId] = {
                employee: emp,
                role: getRole(emp),
                shifts: []
            };
        });
    }

    // B. Merge with Jornadas Data
    jornadas.forEach(jor => {
        if (!jor.empleado) return; // Safety check
        const empId = String(jor.empleado.id);

        // Ensure employee entry exists
        if (!employeeData[empId]) {
            employeeData[empId] = {
                employee: jor.empleado,
                role: getRole(jor.empleado),
                shifts: []
            };
        }

        const start = new Date(jor.horaEntrada);
        // Normalize: If endTime is null, it's an open shift -> NOW (clamped to end of day)
        // But for visual representation, we usually clamp to 'now' or 23:59 if 'now' is past the day.
        // For distinct "TRABAJANDO" status, we treat null as "Active".
        let end = jor.horaSalida ? new Date(jor.horaSalida) : new Date(); // Default to Now if active

        // Clamp to selected day boundaries for safety (timeline is 0-24 of selected date)
        const dayStart = startOfDay(parseISO(date));
        const dayEnd = addHours(dayStart, 24);

        // If 'Active' and day is in past, clamp to end of day? 
        // User req: "Si endTime es null => tramo ABIERTO hasta la hora actual (now)"
        // If viewing a past date, 'now' might be irrelevant or confusing. 
        // Assuming 'now' means literally now, which implies if viewing yesterday and shift is still open, it goes off chart.
        // Let's stick to the request: "hasta la hora actual".

        employeeData[empId].shifts.push({
            start,
            end,
            original: jor
        });
    });

    // 2. ORDERING
    const roleOrder = ['ADMIN', 'OFICINA', 'CONDUCTOR', 'MECANICO', 'EMPLEADO', 'SIN ROL'];

    // Group by Role
    const groupedByRole: Record<string, typeof employeeData[string][]> = {};
    const statsByRole: Record<string, number> = {};

    Object.values(employeeData).forEach(data => {
        // Sort shifts for this employee
        data.shifts.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Normalize Role for grouping (handle unlisted roles as SIN ROL)
        let groupRole = data.role;
        if (!roleOrder.includes(groupRole) && groupRole !== 'SIN ROL') {
            // If role exists but not in strict list, maybe put in 'SIN ROL' or 'OTROS'?
            // User said: "Orden fijo: ... SIN ROL". Any other role technically fits 'SIN ROL' or 'OTROS'.
            // Let's strict map anything else to 'SIN ROL' to be safe, or append 'OTROS'. 
            // Requirement says: "Orden fijo: ... SIN ROL". Implies anything else is not expected or goes there.
            groupRole = 'SIN ROL';
        }

        if (!groupedByRole[groupRole]) groupedByRole[groupRole] = [];
        groupedByRole[groupRole].push(data);
    });

    // Sort Roles according to fixed order
    const sortedRoles = roleOrder.filter(r => groupedByRole[r] && groupedByRole[r].length > 0);

    // Sort Employees within Roles (Alphabetical)
    sortedRoles.forEach(role => {
        groupedByRole[role].sort((a, b) => a.employee.nombre.localeCompare(b.employee.nombre));
        statsByRole[role] = groupedByRole[role].length;
    });

    // 3. UI RENDERING CONSTANTS
    const hours = Array.from({ length: 25 }, (_, i) => i); // 0 to 24
    const dayStart = startOfDay(parseISO(date));

    // VERIFICATION LOGS
    React.useEffect(() => {
        console.group("Cronograma Check");
        console.log(`Fecha: ${date}`);
        console.table(statsByRole);
        Object.keys(groupedByRole).forEach(role => {
            console.groupCollapsed(`Rol: ${role} (${groupedByRole[role].length})`);
            groupedByRole[role].forEach(d => {
                console.log(`${d.employee.nombre}: ${d.shifts.length} tramos`, d.shifts.map(s => ({
                    start: format(s.start, 'HH:mm'),
                    end: format(s.end, 'HH:mm'),
                    duration: differenceInMinutes(s.end, s.start) + 'm'
                })));
            });
            console.groupEnd();
        });
        console.groupEnd();
    }, [date, jornadas, employees]);

    // Helper to calculate percentages
    const getPercent = (dateVal: Date) => {
        const minutes = differenceInMinutes(dateVal, dayStart);
        return Math.max(0, Math.min(100, (minutes / (24 * 60)) * 100)); // Clamp 0-100
    };

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex justify-between items-center">
                    <span>Cronograma de Personal</span>
                    <span className="text-sm font-normal text-gray-500 normal-case">
                        {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: es })}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header: Hours */}
                        <div className="flex border-b pb-2 mb-2 sticky left-0 z-20 bg-white">
                            <div className="w-60 shrink-0 font-bold text-gray-400 text-xs uppercase pl-2">Empleado</div>
                            <div className="flex-1 relative h-6">
                                {hours.map(h => (
                                    <div key={h} className="absolute text-[10px] text-gray-300 border-l pl-1 h-full" style={{ left: `${(h / 24) * 100}%` }}>
                                        {h}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        <div className="space-y-6">
                            {sortedRoles.length === 0 && <p className="text-center text-gray-400 py-8 italic text-sm">No hay datos para mostrar.</p>}

                            {sortedRoles.map(role => (
                                <div key={role} className="space-y-1">
                                    {/* Role Header */}
                                    <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-y border-gray-100 mb-2">
                                        <div className="text-xs font-black text-gray-600 uppercase tracking-wider">{role}</div>
                                        <div className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">{statsByRole[role]}</div>
                                    </div>

                                    {/* Employees */}
                                    {groupedByRole[role].map((data) => {
                                        const { employee, shifts } = data;

                                        // Calculates Breaks & Lunch
                                        let totalBreakMinutes = 0;
                                        let mainLunchMinutes = 0;
                                        const breakSegments: { start: Date, end: Date, minutes: number, isLunch: boolean }[] = [];

                                        for (let i = 0; i < shifts.length - 1; i++) {
                                            const currentEnd = shifts[i].end;
                                            const nextStart = shifts[i + 1].start;

                                            // Check specifically for gap > 0
                                            const diff = differenceInMinutes(nextStart, currentEnd);
                                            if (diff > 0) {
                                                totalBreakMinutes += diff;
                                                breakSegments.push({
                                                    start: currentEnd,
                                                    end: nextStart,
                                                    minutes: diff,
                                                    isLunch: false
                                                });
                                            }
                                        }

                                        // Identify Main Lunch: Longest gap starting between 11:00 and 16:30
                                        // If none in range, take simply the longest.
                                        let maxGap = -1;
                                        let maxGapIndex = -1;

                                        // Variables to find best candidate
                                        let bestLunchIndex = -1;
                                        let bestLunchDuration = -1;

                                        breakSegments.forEach((gap, idx) => {
                                            // Regular max tracking
                                            if (gap.minutes > maxGap) {
                                                maxGap = gap.minutes;
                                                maxGapIndex = idx;
                                            }

                                            // Lunch window check
                                            const gapStartHour = parseInt(format(gap.start, 'HH'));
                                            const gapStartMin = parseInt(format(gap.start, 'mm'));
                                            const numericStart = gapStartHour + (gapStartMin / 60);

                                            // Window: 11.0 to 16.5
                                            if (numericStart >= 11 && numericStart <= 16.5) {
                                                if (gap.minutes > bestLunchDuration) {
                                                    bestLunchDuration = gap.minutes;
                                                    bestLunchIndex = idx;
                                                }
                                            }
                                        });

                                        // If we found a valid lunch in window, use it. Else use absolute max gap.
                                        const finalLunchIndex = bestLunchIndex !== -1 ? bestLunchIndex : maxGapIndex;

                                        if (finalLunchIndex !== -1) {
                                            breakSegments[finalLunchIndex].isLunch = true;
                                            mainLunchMinutes = breakSegments[finalLunchIndex].minutes;
                                        }

                                        const formatHoursMins = (mins: number) => {
                                            const h = Math.floor(mins / 60);
                                            const m = mins % 60;
                                            if (h > 0) return `${h}h ${m}m`;
                                            return `${m}m`;
                                        };

                                        return (
                                            <div key={employee.id} className="flex items-center group hover:bg-blue-50/50 rounded-lg py-1.5 pl-2 transition-colors relative min-h-[40px]">
                                                {/* Background Grid */}
                                                <div className="absolute left-60 right-0 top-0 bottom-0 pointer-events-none">
                                                    {hours.map(h => (
                                                        <div key={h} className="absolute top-0 bottom-0 border-r border-gray-100 group-hover:border-blue-100" style={{ left: `${(h / 24) * 100}%` }}></div>
                                                    ))}
                                                </div>

                                                {/* 1. Employee Info Column */}
                                                <div className="w-60 shrink-0 pr-4 flex items-center gap-3 relative z-10">
                                                    {/* Avatar */}
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-sm border
                                                        ${role === 'CONDUCTOR' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                            role === 'MECANICO' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                                role === 'ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                                    'bg-gray-100 text-gray-700 border-gray-200'}
                                                    `}>
                                                        {employee.nombre.charAt(0)}
                                                    </div>

                                                    {/* Name & Stats */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-gray-800 text-xs truncate">{employee.nombre}</div>
                                                        <div className="flex flex-col">
                                                            {totalBreakMinutes > 0 && (
                                                                <span className="text-[10px] text-gray-500 font-mono">
                                                                    Descanso: {formatHoursMins(totalBreakMinutes)}
                                                                </span>
                                                            )}
                                                            {mainLunchMinutes > 0 && (
                                                                <span className="text-[10px] text-orange-600 font-bold font-mono">
                                                                    Comida: {formatHoursMins(mainLunchMinutes)}
                                                                </span>
                                                            )}
                                                            {shifts.length === 0 && (
                                                                <span className="text-[10px] text-red-400 italic">Sin actividad</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 2. Timeline Column */}
                                                <div className="flex-1 relative h-8 my-auto z-10">
                                                    {/* A. Work Bars */}
                                                    {shifts.map((shift, idx) => {
                                                        const startPct = getPercent(shift.start);
                                                        const endPct = getPercent(shift.end);
                                                        const width = Math.max(endPct - startPct, 0.2); // Min width visibility
                                                        const isActive = !shift.original.horaSalida;

                                                        // Check for conflict (overlap with previous)
                                                        // const prevShift = idx > 0 ? shifts[idx-1] : null;
                                                        // const isConflict = prevShift && prevShift.end > shift.start; 
                                                        // NOTE: Visualizing conflict is hard if they overlap on same line. 
                                                        // For now, we just render them. Transparency works.

                                                        return (
                                                            <TooltipProvider key={idx}>
                                                                <Tooltip delayDuration={0}>
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className={`absolute top-1 bottom-1 rounded-sm shadow-sm transition-all cursor-pointer border
                                                                                ${isActive ? 'bg-green-500 hover:bg-green-600 border-green-600' : 'bg-blue-500 hover:bg-blue-600 border-blue-600'}
                                                                                ${'opacity-90'}
                                                                            `}
                                                                            style={{ left: `${startPct}%`, width: `${width}%` }}
                                                                        />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-slate-900 border-0 text-xs">
                                                                        <div className="font-bold">{employee.nombre}</div>
                                                                        <div>{format(shift.start, 'HH:mm')} - {isActive ? 'En curso' : format(shift.end, 'HH:mm')}</div>
                                                                        {isActive && <div className="text-green-400 font-bold uppercase text-[10px] mt-1">Trabajando</div>}
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        );
                                                    })}

                                                    {/* B. Break/Lunch Bars */}
                                                    {breakSegments.map((gap, idx) => {
                                                        const startPct = getPercent(gap.start);
                                                        const width = getPercent(gap.end) - startPct;

                                                        return (
                                                            <TooltipProvider key={`gap-${idx}`}>
                                                                <Tooltip delayDuration={0}>
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className={`absolute top-2.5 bottom-2.5 flex items-center justify-center cursor-help z-0
                                                                                ${gap.isLunch ? 'bg-orange-100/80 border-t border-b border-orange-200' : 'bg-gray-100/50'}
                                                                            `}
                                                                            style={{ left: `${startPct}%`, width: `${width}%` }}
                                                                        >
                                                                            {/* Only show label if wide enough */}
                                                                            {width > 2 && gap.isLunch && (
                                                                                <span className="text-[8px] font-bold text-orange-700 tracking-tighter uppercase opacity-70">Comida</span>
                                                                            )}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-gray-800 border-0 text-white text-xs">
                                                                        <div className="font-bold text-gray-300 uppercase mb-1">{gap.isLunch ? 'Hora de Comida' : 'Descanso / Pausa'}</div>
                                                                        <div className="font-mono text-center mb-1">{format(gap.start, 'HH:mm')} ➔ {format(gap.end, 'HH:mm')}</div>
                                                                        <div className="font-black text-lg text-center">{gap.minutes} min</div>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
