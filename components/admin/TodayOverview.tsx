'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { UserX, Clock, CalendarDays, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmployeeSimple {
    id: number;
    nombre: string;
    apellidos: string | null;
    rol: string;
}

interface Absence {
    id: number;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    horas?: number | null;
    empleado: EmployeeSimple;
}

interface DashboardStats {
    absentToday: Absence[];
    upcomingAbsences: Absence[];
    pendingCount: number;
}

interface TodayOverviewProps {
    stats: DashboardStats;
    loading: boolean;
}

export default function TodayOverview({ stats, loading }: TodayOverviewProps) {
    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg"></div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 1. Ausentes Hoy */}
            <Card className={`border-l-4 ${stats.absentToday.length > 0 ? 'border-l-red-500' : 'border-l-green-500'} shadow-sm`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2">
                        <UserX className="w-4 h-4" />
                        Ausentes Hoy
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-800">{stats.absentToday.length}</div>
                    <div className="mt-2 space-y-2">
                        {stats.absentToday.length === 0 ? (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Plantilla al completo
                            </p>
                        ) : (
                            stats.absentToday.map(abs => (
                                <div key={abs.id} className="text-xs flex justify-between items-center bg-red-50 p-1.5 rounded border border-red-100">
                                    <span className="font-medium text-gray-700">{abs.empleado.nombre} {abs.empleado.apellidos}</span>
                                    <span className="px-1.5 py-0.5 bg-white rounded text-[10px] font-bold text-red-600 uppercase border border-red-100">
                                        {abs.tipo} {abs.horas ? `(${abs.horas}h)` : ''}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 2. Próximas Salidas */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Próximos 3 Días
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-800">{stats.upcomingAbsences.length}</div>
                    <div className="mt-2 space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                        {stats.upcomingAbsences.length === 0 ? (
                            <p className="text-xs text-gray-400">Sin salidas programadas.</p>
                        ) : (
                            stats.upcomingAbsences.map(abs => (
                                <div key={abs.id} className="text-xs flex justify-between items-center text-gray-600">
                                    <span>{abs.empleado.nombre}</span>
                                    <span className="text-gray-400 text-[10px]">
                                        {format(new Date(abs.fechaInicio), 'd MMM', { locale: es })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* 3. Solicitudes Pendientes */}
            <Card className={`border-l-4 ${stats.pendingCount > 0 ? 'border-l-yellow-400 bg-yellow-50/30' : 'border-l-gray-300'} shadow-sm`}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-500 uppercase flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pendientes Aprobación
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${stats.pendingCount > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>
                        {stats.pendingCount}
                    </div>
                    {stats.pendingCount > 0 && (
                        <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Requiere atención
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
