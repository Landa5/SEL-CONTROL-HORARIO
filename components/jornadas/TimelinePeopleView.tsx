'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { format, differenceInMinutes, parseISO, startOfDay, addHours, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';
import { Layers, Minimize2, Maximize2, Clock, Users } from 'lucide-react';

interface TimelinePeopleViewProps {
    jornadas: any[];
    date: string;
    employees?: any[];
}

export default function TimelinePeopleView({ jornadas, date, employees = [] }: TimelinePeopleViewProps) {
    const [viewMode, setViewMode] = useState<'expanded' | 'compact'>('expanded');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showAllEmployees, setShowAllEmployees] = useState(false); // Default: Show only active

    // Update "Now" indicator every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 1. DATA PROCESSING (Memoized)
    const { sortedRoles, groupedByRole, statsByRole } = useMemo(() => {
        const employeeData: Record<string, {
            employee: any,
            role: string,
            shifts: { start: Date, end: Date, original: any, isActive: boolean }[],
            totalMinutes: number
            status: 'active' | 'inactive' | 'finished'
        }> = {};

        const getRole = (emp: any) => emp.rol || 'OTROS';

        // Initialize with all employees IF showAllEmployees is true
        if (showAllEmployees && Array.isArray(employees)) {
            employees.forEach(emp => {
                if (!emp || !emp.activo) return;
                const strId = String(emp.id);
                employeeData[strId] = {
                    employee: emp,
                    role: getRole(emp),
                    shifts: [],
                    totalMinutes: 0,
                    status: 'inactive'
                };
            });
        }

        // Merge Jornadas
        if (Array.isArray(jornadas)) {
            jornadas.forEach(jor => {
                if (!jor || !jor.empleado) return;
                const empId = String(jor.empleado.id);

                // Find existing entry (string vs number match) - ROBUST
                let existingKey = Object.keys(employeeData).find(k => String(k) === empId);

                if (!existingKey) {
                    // Create if not found
                    employeeData[empId] = {
                        employee: jor.empleado,
                        role: getRole(jor.empleado),
                        shifts: [],
                        totalMinutes: 0,
                        status: 'finished'
                    };
                    existingKey = empId;
                }

                // REFERENCE to the employee object
                const entry = employeeData[existingKey];

                const start = new Date(jor.horaEntrada);
                const end = jor.horaSalida ? new Date(jor.horaSalida) : new Date();
                const isActive = !jor.horaSalida;

                entry.shifts.push({ start, end, original: jor, isActive });
                entry.status = isActive ? 'active' : 'finished';

                if (jor.totalHoras) {
                    entry.totalMinutes += jor.totalHoras * 60;
                } else {
                    entry.totalMinutes += differenceInMinutes(end, start);
                }
            });
        }

        // Grouping
        const roleOrder = ['ADMIN', 'OFICINA', 'JEFE_TRAFICO', 'CONDUCTOR', 'MECANICO', 'EMPLEADO', 'OTROS'];
        const grouped: Record<string, typeof employeeData[string][]> = {};
        const stats: Record<string, number> = {};

        Object.values(employeeData).forEach(data => {
            data.shifts.sort((a, b) => a.start.getTime() - b.start.getTime());

            let role = data.role;
            if (!roleOrder.includes(role)) role = 'OTROS';

            if (!grouped[role]) grouped[role] = [];
            grouped[role].push(data);
        });

        // Sort inside groups
        const sortedRoleKeys = roleOrder.filter(r => grouped[r] && grouped[r].length > 0);
        sortedRoleKeys.forEach(r => {
            grouped[r].sort((a, b) => a.employee.nombre.localeCompare(b.employee.nombre));
            stats[r] = grouped[r].length;
        });

        return { sortedRoles: sortedRoleKeys, groupedByRole: grouped, statsByRole: stats };
    }, [jornadas, employees, date, showAllEmployees]);

    // 2. RENDERING HELPERS
    const startOfDayDate = startOfDay(parseISO(date));
    const hours = Array.from({ length: 25 }, (_, i) => i);

    const getPercent = (dateVal: Date) => {
        const minutes = differenceInMinutes(dateVal, startOfDayDate);
        return Math.max(0, Math.min(100, (minutes / (24 * 60)) * 100));
    };

    const isToday = isSameDay(parseISO(date), new Date());
    const currentTimePct = isToday ? getPercent(currentTime) : -1;

    // Role Colors
    const getRoleColor = (role: string) => {
        switch (role) {
            case 'CONDUCTOR': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'MECANICO': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'OFICINA': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-4 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gray-400" />
                            Cronograma de Personal
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                            {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: es })}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 text-xs mr-4 bg-gray-50 px-3 py-1 rounded-full border">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-bold text-gray-600">En Turno</span>
                            <div className="w-2 h-2 rounded-full bg-blue-400 ml-2"></div>
                            <span className="font-bold text-gray-600">Finalizado</span>
                            <div className="w-2 h-2 rounded-full bg-orange-200 ml-2"></div>
                            <span className="font-bold text-gray-600">Descanso</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAllEmployees(prev => !prev)}
                            className={`gap-2 text-xs font-bold ${showAllEmployees ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
                        >
                            <Users className="w-3 h-3" />
                            {showAllEmployees ? 'Todos' : 'Activos'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewMode(prev => prev === 'expanded' ? 'compact' : 'expanded')}
                            className="gap-2 text-xs font-bold"
                        >
                            {viewMode === 'expanded' ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                            {viewMode === 'expanded' ? 'Compacto' : 'Detallado'}
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <div className="min-w-[800px] relative">

                        {/* HEADER: HOURS */}
                        <div className="flex border-b bg-gray-50/80 sticky top-0 z-30 backdrop-blur-sm">
                            <div className="w-56 shrink-0 p-3 font-bold text-gray-400 text-xs uppercase tracking-wider border-r bg-gray-50">
                                Empleado
                            </div>
                            <div className="flex-1 relative h-8">
                                {hours.map(h => (
                                    <div key={h} className="absolute text-[10px] font-bold text-gray-400 h-full flex flex-col justify-end pb-1 border-l border-gray-200/50 pl-1" style={{ left: `${(h / 24) * 100}%` }}>
                                        {h}
                                    </div>
                                ))}
                                {/* Current Time Indicator Header */}
                                {currentTimePct >= 0 && (
                                    <div
                                        className="absolute top-0 bottom-0 border-l-2 border-red-500 z-40 transform -translate-x-1/2"
                                        style={{ left: `${currentTimePct}%` }}
                                    >
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1 rounded font-bold">
                                            {format(currentTime, 'HH:mm')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BODY */}
                        <div className="relative">
                            {/* Background Grid Lines */}
                            <div className="absolute inset-0 pointer-events-none z-0 ml-56">
                                {hours.map(h => (
                                    <div key={h} className="absolute top-0 bottom-0 border-r border-gray-100" style={{ left: `${(h / 24) * 100}%` }}></div>
                                ))}
                                {currentTimePct >= 0 && (
                                    <div className="absolute top-0 bottom-0 border-l border-dashed border-red-300 z-0" style={{ left: `${currentTimePct}%` }}></div>
                                )}
                            </div>

                            {/* ROLES SECTIONS */}
                            {sortedRoles.length === 0 && <div className="p-12 text-center text-gray-400 italic">No hay registros para este día.</div>}

                            {sortedRoles.map(role => (
                                <div key={role} className="relative z-10 border-b last:border-0 group-role">
                                    {/* Role Label */}
                                    <div className="sticky left-0 z-20 bg-white/95 border-b border-gray-100 px-3 py-1.5 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{role}</span>
                                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 rounded-full font-bold">{statsByRole[role]}</span>
                                    </div>

                                    {/* Employees */}
                                    {groupedByRole[role].map((data, idx) => {
                                        const { employee, shifts, totalMinutes, status } = data;

                                        // Calculations for gaps (Breaks)
                                        const segments: React.ReactNode[] = [];

                                        for (let i = 0; i < shifts.length; i++) {
                                            const shift = shifts[i];
                                            const startPct = getPercent(shift.start);
                                            const endPct = getPercent(shift.end);
                                            const width = Math.max(endPct - startPct, 0.4);

                                            // WORK SEGMENT
                                            segments.push(
                                                <TooltipProvider key={`work-${i}`}>
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className={`absolute top-1.5 bottom-1.5 rounded-sm shadow-sm transition-all hover:scale-y-110 hover:brightness-110 hover:z-20 cursor-pointer
                                                                    ${shift.isActive ? 'bg-gradient-to-r from-green-500 to-green-400 ring-1 ring-green-600' : 'bg-blue-400 ring-1 ring-blue-500'}
                                                                `}
                                                                style={{ left: `${startPct}%`, width: `${width}%` }}
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-gray-900 text-white text-xs border-0">
                                                            <p className="font-bold">{employee.nombre}</p>
                                                            <p className="font-mono">{format(shift.start, 'HH:mm')} - {shift.isActive ? 'En curso' : format(shift.end, 'HH:mm')}</p>
                                                            {shift.isActive && <p className="text-green-400 font-bold uppercase text-[10px] mt-1">Activo ahora</p>}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );

                                            // BREAK SEGMENT (Gap to next shift)
                                            if (i < shifts.length - 1) {
                                                const nextShift = shifts[i + 1];
                                                const gapStartPct = endPct;
                                                const gapEndPct = getPercent(nextShift.start);
                                                const gapWidth = gapEndPct - gapStartPct;

                                                if (gapWidth > 0.5) { // Only show significant gaps
                                                    const isLunch = (gapWidth > (30 / (24 * 60)) * 100); // Rough heuristic: >30min is visual break

                                                    segments.push(
                                                        <TooltipProvider key={`gap-${i}`}>
                                                            <Tooltip delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        className={`absolute top-3 bottom-3 bg-orange-100/50 border-t border-b border-orange-200 cursor-help z-0 flex items-center justify-center`}
                                                                        style={{ left: `${gapStartPct}%`, width: `${gapWidth}%` }}
                                                                    >
                                                                        {viewMode === 'expanded' && gapWidth > 2 && <span className="text-[8px] text-orange-400 font-bold opacity-0 hover:opacity-100">PAUSA</span>}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="bg-orange-50 text-orange-900 border-orange-200 text-xs">
                                                                    <p className="font-bold uppercase">Pausa / Descanso</p>
                                                                    <p className="font-mono">{format(shift.end, 'HH:mm')} ➔ {format(nextShift.start, 'HH:mm')}</p>
                                                                    <p className="font-black">{differenceInMinutes(nextShift.start, shift.end)} min</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    );
                                                }
                                            }
                                        }

                                        return (
                                            <div
                                                key={employee.id}
                                                className={`flex items-center hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0
                                                    ${viewMode === 'compact' ? 'h-8' : 'h-10'}
                                                `}
                                            >
                                                {/* Left Column: Info */}
                                                <div className="w-56 shrink-0 border-r bg-white sticky left-0 z-20 flex items-center px-3 gap-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase border shadow-sm ${getRoleColor(role)}`}>
                                                        {employee.nombre.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate font-bold text-gray-700 text-xs leading-none">{employee.nombre}</div>
                                                        {totalMinutes > 0 ? (
                                                            <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                                                                {Math.floor(totalMinutes / 60)}h {Math.round(totalMinutes % 60)}m
                                                            </div>
                                                        ) : (
                                                            <div className="text-[9px] text-red-300 italic">Inactivo</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right Column: Timeline */}
                                                <div className="flex-1 relative h-full">
                                                    {segments}
                                                </div>
                                            </div>
                                        )
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
