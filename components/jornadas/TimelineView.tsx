'use client';

import React from 'react';
import { format, differenceInMinutes, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

interface TimelineViewProps {
    jornadas: any[];
    date: string;
}

export default function TimelineView({ jornadas, date }: TimelineViewProps) {
    // 1. Extract unique trucks from jornadas
    const truckMap: Record<number, any> = {};

    jornadas.forEach(jor => {
        jor.usosCamion.forEach((uso: any) => {
            if (!truckMap[uso.camionId]) {
                truckMap[uso.camionId] = {
                    id: uso.camionId,
                    matricula: uso.camion?.matricula || 'Desconocido',
                    modelo: uso.camion?.modelo,
                    usos: []
                };
            }
            truckMap[uso.camionId].usos.push({
                ...uso,
                empleadoNombre: jor.empleado.nombre
            });
        });
    });

    const trucks = Object.values(truckMap).sort((a, b) => a.matricula.localeCompare(b.matricula));

    // Time slots generation (00:00 to 23:00)
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex justify-between items-center">
                    <span>Cronograma de Rutas</span>
                    <span className="text-sm font-normal text-gray-500 normal-case">
                        {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: es })}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header: Hours */}
                        <div className="flex border-b pb-2 mb-2">
                            <div className="w-32 shrink-0 font-bold text-gray-400 text-xs uppercase">Vehículo</div>
                            <div className="flex-1 relative h-6">
                                {hours.map(h => (
                                    <div key={h} className="absolute text-[10px] text-gray-400 border-l pl-1 h-full" style={{ left: `${(h / 24) * 100}%` }}>
                                        {h}:00
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows: Trucks */}
                        <div className="space-y-4">
                            {trucks.length === 0 && <p className="text-center text-gray-400 py-8 italic text-sm">No hay actividad de camiones registrada para este día.</p>}

                            {trucks.map(truck => (
                                <div key={truck.id} className="flex items-center group hover:bg-gray-50 rounded-lg p-1 transition-colors">
                                    {/* Truck Label */}
                                    <div className="w-32 shrink-0 pr-4">
                                        <div className="font-black text-gray-800 text-sm">{truck.matricula}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{truck.modelo}</div>
                                    </div>

                                    {/* Timeline Lane */}
                                    <div className="flex-1 relative h-10 bg-gray-100 rounded-md overflow-hidden">
                                        {/* Grid lines */}
                                        {hours.map(h => (
                                            <div key={h} className="absolute top-0 bottom-0 border-r border-gray-200" style={{ left: `${(h / 24) * 100}%` }}></div>
                                        ))}

                                        {/* Bars */}
                                        {truck.usos.map((uso: any) => {
                                            const start = new Date(uso.horaInicio);
                                            const end = uso.horaFin ? new Date(uso.horaFin) : new Date(); // If running, use now or cap at end of day

                                            // Normalize to current day (0-24h)
                                            const dayStart = startOfDay(parseISO(date));

                                            // Calculate offset minutes from start of day
                                            let startMinutes = differenceInMinutes(start, dayStart);
                                            let durationMinutes = differenceInMinutes(end, start);

                                            if (startMinutes < 0) startMinutes = 0; // Started prev day
                                            // if duration extends beyond day... visual clip by container overflow-hidden

                                            const leftPercent = (startMinutes / (24 * 60)) * 100;
                                            const widthPercent = (durationMinutes / (24 * 60)) * 100;

                                            return (
                                                <TooltipProvider key={uso.id}>
                                                    <Tooltip delayDuration={0}>
                                                        <TooltipTrigger asChild>
                                                            <div
                                                                className="absolute top-1 bottom-1 rounded shadow-sm bg-blue-500 hover:bg-blue-600 cursor-pointer transition-all border border-blue-600 z-10"
                                                                style={{
                                                                    left: `${leftPercent}%`,
                                                                    width: `${Math.max(widthPercent, 0.5)}%` // min width visibility
                                                                }}
                                                            >
                                                                {widthPercent > 5 && (
                                                                    <span className="text-[10px] text-white font-bold px-1 truncate block">
                                                                        {uso.empleadoNombre}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-slate-900 text-white border-0 z-50">
                                                            <div className="text-xs">
                                                                <p className="font-bold mb-1">{uso.empleadoNombre}</p>
                                                                <p>{format(start, 'HH:mm')} - {uso.horaFin ? format(end, 'HH:mm') : 'En curso'}</p>
                                                                <p className="mt-1 opacity-70">
                                                                    {uso.kmInicial} - {uso.kmFinal || '...'} km
                                                                </p>
                                                                <p className="opacity-70">Viajes: {uso.viajesCount || 0}</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
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
