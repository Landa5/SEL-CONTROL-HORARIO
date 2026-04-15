'use client';

import React from 'react';
import {
    UserX, Clock, CalendarDays, AlertCircle, CheckCircle2,
    ArrowRight, Sun, Thermometer, FileText, Users, TrendingDown
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
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

const TYPE_ICON: Record<string, { icon: typeof Sun; color: string; bg: string; label: string }> = {
    VACACIONES: { icon: Sun, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Vacaciones' },
    BAJA: { icon: Thermometer, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Baja Médica' },
    PERMISO: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Permiso' },
    OTROS: { icon: CalendarDays, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Otros' },
};

export default function TodayOverview({ stats, loading }: TodayOverviewProps) {
    if (loading) return (
        <div className="space-y-4">
            <div className="animate-pulse h-28 bg-gray-100 rounded-xl"></div>
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl"></div>)}
            </div>
        </div>
    );

    const hasAbsent = stats.absentToday.length > 0;
    const hasPending = stats.pendingCount > 0;
    const hasUpcoming = stats.upcomingAbsences.length > 0;

    // Group absent today by type
    const absentByType: Record<string, Absence[]> = {};
    stats.absentToday.forEach(abs => {
        if (!absentByType[abs.tipo]) absentByType[abs.tipo] = [];
        absentByType[abs.tipo].push(abs);
    });

    return (
        <div className="space-y-4">
            {/* ─── BANNER PRINCIPAL: Estado del equipo hoy ─── */}
            <div className={`rounded-2xl p-5 shadow-sm border transition-all ${
                hasAbsent
                    ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
                    : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
            }`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                            hasAbsent ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                            {hasAbsent
                                ? <UserX className="w-6 h-6 text-red-600" />
                                : <CheckCircle2 className="w-6 h-6 text-green-600" />
                            }
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${hasAbsent ? 'text-red-800' : 'text-green-800'}`}>
                                {hasAbsent
                                    ? `${stats.absentToday.length} persona${stats.absentToday.length > 1 ? 's' : ''} ausente${stats.absentToday.length > 1 ? 's' : ''}`
                                    : 'Equipo al completo'
                                }
                            </h3>
                            <p className={`text-sm ${hasAbsent ? 'text-red-600' : 'text-green-600'}`}>
                                {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                            </p>
                        </div>
                    </div>

                    {/* Quick counters */}
                    <div className="flex gap-3">
                        {hasPending && (
                            <div className="bg-amber-100 border border-amber-200 px-3 py-2 rounded-xl text-center min-w-[70px] shadow-sm">
                                <p className="text-xl font-black text-amber-700">{stats.pendingCount}</p>
                                <p className="text-[10px] font-bold text-amber-600 uppercase">Pendiente{stats.pendingCount > 1 ? 's' : ''}</p>
                            </div>
                        )}
                        {hasUpcoming && (
                            <div className="bg-blue-100 border border-blue-200 px-3 py-2 rounded-xl text-center min-w-[70px] shadow-sm">
                                <p className="text-xl font-black text-blue-700">{stats.upcomingAbsences.length}</p>
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Próximas</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista de ausentes hoy */}
                {hasAbsent && (
                    <div className="mt-4 space-y-2">
                        {Object.entries(absentByType).map(([tipo, absences]) => {
                            const cfg = TYPE_ICON[tipo] || TYPE_ICON.OTROS;
                            const Icon = cfg.icon;
                            return (
                                <div key={tipo}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <div className={`p-1 rounded ${cfg.bg}`}>
                                            <Icon className={`w-3 h-3 ${cfg.color}`} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 uppercase">{cfg.label}</span>
                                        <span className="text-[10px] text-gray-400">({absences.length})</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 ml-6">
                                        {absences.map(abs => (
                                            <div
                                                key={abs.id}
                                                className="bg-white/80 backdrop-blur-sm border border-white rounded-lg px-3 py-2 flex items-center justify-between shadow-sm"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                                        {abs.empleado.nombre} {abs.empleado.apellidos}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {format(new Date(abs.fechaInicio), 'd MMM', { locale: es })}
                                                        {abs.fechaInicio !== abs.fechaFin && (
                                                            <> → {format(new Date(abs.fechaFin), 'd MMM', { locale: es })}</>
                                                        )}
                                                        {abs.horas ? ` (${abs.horas}h)` : ''}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-medium uppercase shrink-0 ml-2">
                                                    {abs.empleado.rol}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── TARJETAS INFERIORES: Pendientes + Próximas ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Solicitudes Pendientes */}
                <div className={`rounded-xl border shadow-sm overflow-hidden ${
                    hasPending ? 'border-amber-200' : 'border-gray-200'
                }`}>
                    <div className={`px-4 py-3 flex items-center justify-between ${
                        hasPending ? 'bg-amber-50' : 'bg-gray-50'
                    }`}>
                        <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${hasPending ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                <Clock className={`w-4 h-4 ${hasPending ? 'text-amber-600' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-700">Pendientes de Aprobación</h4>
                            </div>
                        </div>
                        <span className={`text-2xl font-black ${
                            hasPending ? 'text-amber-600' : 'text-gray-300'
                        }`}>
                            {stats.pendingCount}
                        </span>
                    </div>
                    <div className="p-4 bg-white">
                        {hasPending ? (
                            <div className="flex items-center gap-2 text-sm">
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                <p className="text-gray-600">
                                    Hay <span className="font-bold text-amber-700">{stats.pendingCount}</span> solicitud{stats.pendingCount > 1 ? 'es' : ''} esperando
                                    tu revisión. Consulta la tabla de abajo para aprobar o denegar.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                <p>No hay solicitudes pendientes. ¡Todo al día!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Próximas Ausencias (3 días) */}
                <div className="rounded-xl border border-blue-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between bg-blue-50">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-100">
                                <CalendarDays className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-700">Próximos 7 Días</h4>
                            </div>
                        </div>
                        <span className={`text-2xl font-black ${
                            hasUpcoming ? 'text-blue-600' : 'text-gray-300'
                        }`}>
                            {stats.upcomingAbsences.length}
                        </span>
                    </div>
                    <div className="p-3 bg-white">
                        {!hasUpcoming ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400 px-1">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                <p>Sin salidas programadas próximamente.</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                {stats.upcomingAbsences.map(abs => {
                                    const cfg = TYPE_ICON[abs.tipo] || TYPE_ICON.OTROS;
                                    const Icon = cfg.icon;
                                    const dias = differenceInCalendarDays(new Date(abs.fechaFin), new Date(abs.fechaInicio)) + 1;

                                    return (
                                        <div key={abs.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`p-1 rounded ${cfg.bg} shrink-0`}>
                                                    <Icon className={`w-3 h-3 ${cfg.color}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">
                                                        {abs.empleado.nombre} {abs.empleado.apellidos}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 text-xs">
                                                <span className="text-gray-500 font-medium">
                                                    {format(new Date(abs.fechaInicio), 'd MMM', { locale: es })}
                                                </span>
                                                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                                    {dias}d
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
