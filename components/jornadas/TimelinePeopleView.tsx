'use client';

import React from 'react';
import { format, differenceInMinutes, parseISO, startOfDay, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

interface TimelinePeopleViewProps {
    jornadas: any[];
    date: string;
}

export default function TimelinePeopleView({ jornadas, date }: TimelinePeopleViewProps) {
    // 1. Organize data by Role and then by Employee
    const roleGroups: Record<string, Record<string, { employee: any, jornadas: any[] }>> = {};

    jornadas.forEach(jor => {
        const role = jor.empleado.rol || 'OTROS';
        const empId = jor.empleado.id; // Assuming employee has an ID

        if (!roleGroups[role]) roleGroups[role] = {};
        if (!roleGroups[role][empId]) {
            roleGroups[role][empId] = {
                employee: jor.empleado,
                jornadas: []
            };
        }
        roleGroups[role][empId].jornadas.push(jor);
    });

    // Custom sort order
    const roleOrder = ['ADMIN', 'OFICINA', 'JEFE_TRAFICO', 'CONDUCTOR', 'MECANICO'];
    const sortedRoles = Object.keys(roleGroups).sort((a, b) => {
        const idxA = roleOrder.indexOf(a);
        const idxB = roleOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    // Sort people within roles
    const sortedRoleGroups: Record<string, { employee: any, jornadas: any[] }[]> = {};
    sortedRoles.forEach(role => {
        const peopleInRole = Object.values(roleGroups[role]);
        peopleInRole.sort((a, b) => a.employee.nombre.localeCompare(b.employee.nombre));
        sortedRoleGroups[role] = peopleInRole;
    });

    // Time slots generation (00:00 to 23:00)
    const hours = Array.from({ length: 24 }, (_, i) => i);

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
                            <div className="w-44 shrink-0 font-bold text-gray-400 text-xs uppercase pl-2">Empleado</div>
                            <div className="flex-1 relative h-6">
                                {hours.map(h => (
                                    <div key={h} className="absolute text-[10px] text-gray-300 border-l pl-1 h-full" style={{ left: `${(h / 24) * 100}%` }}>
                                        {h}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows: Groups */}
                        <div className="space-y-6">
                            {jornadas.length === 0 && <p className="text-center text-gray-400 py-8 italic text-sm">No hay actividad de personal registrada para este día.</p>}

                            {sortedRoles.map(role => (
                                <div key={role} className="space-y-2">
                                    <div className="flex items-center gap-2 px-2 pb-1 border-b border-gray-100">
                                        <div className="text-xs font-black text-gray-400 uppercase tracking-wider">{role}</div>
                                        <div className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">{sortedRoleGroups[role].length}</div>
                                    </div>

                                    <div className="space-y-1">
                                        {sortedRoleGroups[role].map(({ employee, jornadas: empJornadas }) => (
                                            <div key={employee.id} className="flex items-center group hover:bg-gray-50 rounded-lg py-1.5 pl-2 transition-colors relative">
                                                {/* Background Grid for this row */}
                                                <div className="absolute left-44 right-0 top-0 bottom-0 pointer-events-none">
                                                    {hours.map(h => (
                                                        <div key={h} className="absolute top-0 bottom-0 border-r border-gray-50 group-hover:border-white/50" style={{ left: `${(h / 24) * 100}%` }}></div>
                                                    ))}
                                                </div>

                                                {/* Person Label */}
                                                <div className="w-44 shrink-0 pr-4 flex items-center gap-2 relative z-10">
                                                    <div className={`w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center
                                                        ${role === 'CONDUCTOR' ? 'bg-blue-100 text-blue-700' :
                                                            role === 'MECANICO' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-gray-100 text-gray-700'}
                                                    `}>
                                                        {employee.nombre.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-gray-700 text-xs truncate w-28">{employee.nombre}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono flex flex-col gap-0.5">
                                                            {(() => {
                                                                // Calculate Total Break Time
                                                                const sorted = [...empJornadas].sort((a, b) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());
                                                                let totalBreak = 0;
                                                                for (let i = 1; i < sorted.length; i++) {
                                                                    const prevEnd = new Date(sorted[i - 1].horaSalida);
                                                                    const currStart = new Date(sorted[i].horaEntrada);
                                                                    if (sorted[i - 1].horaSalida) {
                                                                        const gap = differenceInMinutes(currStart, prevEnd);
                                                                        if (gap > 0) totalBreak += gap;
                                                                    }
                                                                }
                                                                if (totalBreak > 0) {
                                                                    const h = Math.floor(totalBreak / 60);
                                                                    const m = totalBreak % 60;
                                                                    return (
                                                                        <span className="text-orange-600 font-bold mt-1 block">
                                                                            Descanso: {h > 0 ? `${h}h ` : ''}{m}m
                                                                        </span>
                                                                    )
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Timeline Lane */}
                                                <div className="flex-1 relative h-6 bg-gray-100/30 rounded-full overflow-hidden z-10">
                                                    {/* Render multiple bars for this employee */}
                                                    {(() => {
                                                        const sortedJornadas = [...empJornadas].sort((a, b) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());
                                                        const dayStart = startOfDay(parseISO(date));

                                                        return sortedJornadas.flatMap((jor, index) => {
                                                            const start = new Date(jor.horaEntrada);
                                                            const end = jor.horaSalida ? new Date(jor.horaSalida) : new Date();

                                                            let startMinutes = differenceInMinutes(start, dayStart);
                                                            let durationMinutes = differenceInMinutes(end, start);

                                                            // if (startMinutes < 0) startMinutes = 0;

                                                            const leftPercent = (startMinutes / (24 * 60)) * 100;
                                                            const widthPercent = (durationMinutes / (24 * 60)) * 100;

                                                            const elements = [
                                                                <TooltipProvider key={`jor-${jor.id}`}>
                                                                    <Tooltip delayDuration={0}>
                                                                        <TooltipTrigger asChild>
                                                                            <div
                                                                                className={`absolute top-0 bottom-0 rounded-sm shadow-sm cursor-pointer transition-all border z-20
                                                                                    ${jor.horaSalida ? 'bg-green-500/90 hover:bg-green-600 border-green-600' : 'bg-blue-500/90 hover:bg-blue-600 border-blue-600 animate-pulse'}
                                                                                `}
                                                                                style={{
                                                                                    left: `${leftPercent}%`,
                                                                                    width: `${Math.max(widthPercent, 0.5)}%`
                                                                                }}
                                                                            >
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="bg-slate-900 text-white border-0 z-50">
                                                                            <div className="text-xs">
                                                                                <p className="font-bold mb-1">{jor.empleado.nombre}</p>
                                                                                <p className="text-[10px] uppercase text-gray-400 mb-1">{role}</p>
                                                                                <p>{format(start, 'HH:mm')} - {jor.horaSalida ? format(end, 'HH:mm') : 'En curso'}</p>
                                                                                <p className="opacity-70 mt-1">Total: {((durationMinutes / 60)).toFixed(2)}h</p>
                                                                            </div>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            ];

                                                            // Calculate GAP with previous jornada
                                                            if (index > 0) {
                                                                const prevJor = sortedJornadas[index - 1];
                                                                if (prevJor.horaSalida) {
                                                                    const prevEnd = new Date(prevJor.horaSalida);
                                                                    const gapMinutes = differenceInMinutes(start, prevEnd);

                                                                    if (gapMinutes > 0) {
                                                                        const prevEndMinutes = differenceInMinutes(prevEnd, dayStart);
                                                                        const gapLeftPercent = (prevEndMinutes / (24 * 60)) * 100;
                                                                        const gapWidthPercent = (gapMinutes / (24 * 60)) * 100;

                                                                        elements.unshift(
                                                                            <TooltipProvider key={`gap-${index}`}>
                                                                                <Tooltip delayDuration={0}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div
                                                                                            className="absolute top-1.5 bottom-1.5 bg-gray-200/50 hover:bg-gray-300 transition-colors cursor-help z-10 flex items-center justify-center"
                                                                                            style={{
                                                                                                left: `${gapLeftPercent}%`,
                                                                                                width: `${gapWidthPercent}%`
                                                                                            }}
                                                                                        >
                                                                                            {gapWidthPercent > 2 && <span className="text-[8px] text-gray-500 font-bold">descanso</span>}
                                                                                        </div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="bg-gray-800 text-white border-0 z-50">
                                                                                        <div className="text-xs text-center">
                                                                                            <p className="font-bold text-gray-300 mb-1 uppercase tracking-wider">Tiempo Libre / Comida</p>
                                                                                            <p className="font-mono">{format(prevEnd, 'HH:mm')} ➔ {format(start, 'HH:mm')}</p>
                                                                                            <p className="font-black text-white text-lg mt-1">{Math.floor(gapMinutes / 60)}h {gapMinutes % 60}m</p>
                                                                                        </div>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        );
                                                                    }
                                                                }
                                                            }
                                                            return elements;
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
