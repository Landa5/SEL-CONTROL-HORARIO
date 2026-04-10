'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    X, Calendar, Sun, Thermometer, FileText, ChevronLeft, ChevronRight,
    Clock, CheckCircle, XCircle, ArrowRight, TrendingUp, User, AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { format, differenceInCalendarDays, getYear, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface Ausencia {
    id: number;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    horas?: number | null;
    observaciones?: string | null;
    justificanteUrl?: string | null;
    createdAt?: string;
}

interface Compensacion {
    id: number;
    tipo: string;
    valor: number;
    motivo: string;
    fiesta: {
        nombre: string;
        fecha: string;
    };
    createdAt?: string;
}

interface EmployeeStats {
    empleadoId: number;
    nombre: string;
    usuario: string;
    rol: string;
    totalVacaciones: number;
    diasExtras: number;
    horasExtra: number;
    diasDisfrutados: number;
    diasRestantes: number;
    diasSolicitados: number;
    numSolicitudesPendientes: number;
    ausencias: Ausencia[];
    compensaciones?: Compensacion[];
}

interface EmployeeAbsenceDetailProps {
    employee: EmployeeStats;
    onClose: () => void;
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const TYPE_CONFIG: Record<string, { icon: typeof Sun; label: string; color: string; bgLight: string; bgBadge: string; borderColor: string; textColor: string; }> = {
    VACACIONES: { icon: Sun, label: 'Vacaciones', color: '#3b82f6', bgLight: 'bg-blue-50', bgBadge: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
    BAJA:       { icon: Thermometer, label: 'Baja Médica', color: '#f97316', bgLight: 'bg-orange-50', bgBadge: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-200', textColor: 'text-orange-700' },
    PERMISO:    { icon: FileText, label: 'Permiso', color: '#8b5cf6', bgLight: 'bg-purple-50', bgBadge: 'bg-purple-100 text-purple-700', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
    OTROS:      { icon: Calendar, label: 'Otros', color: '#6b7280', bgLight: 'bg-gray-50', bgBadge: 'bg-gray-100 text-gray-700', borderColor: 'border-gray-200', textColor: 'text-gray-700' },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
    PENDIENTE: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-700', icon: Clock },
    APROBADA:  { label: 'Aprobada', badge: 'bg-green-100 text-green-700', icon: CheckCircle },
    DENEGADA:  { label: 'Denegada', badge: 'bg-red-100 text-red-700', icon: XCircle },
    CANCELADA: { label: 'Cancelada', badge: 'bg-gray-100 text-gray-500', icon: XCircle },
};

export default function EmployeeAbsenceDetail({ employee, onClose }: EmployeeAbsenceDetailProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Get available years from employee absences
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        years.add(currentYear);
        employee.ausencias.forEach(a => {
            years.add(getYear(new Date(a.fechaInicio)));
            years.add(getYear(new Date(a.fechaFin)));
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [employee.ausencias, currentYear]);

    // Filter absences for selected year
    const yearAusencias = useMemo(() => {
        return employee.ausencias.filter(a => {
            const startYear = getYear(new Date(a.fechaInicio));
            const endYear = getYear(new Date(a.fechaFin));
            return startYear === selectedYear || endYear === selectedYear;
        });
    }, [employee.ausencias, selectedYear]);

    // Group absences by month
    const monthlyGroups = useMemo(() => {
        const groups: Record<number, Ausencia[]> = {};
        yearAusencias.forEach(a => {
            const month = getMonth(new Date(a.fechaInicio));
            if (!groups[month]) groups[month] = [];
            groups[month].push(a);
        });
        // Sort each month by date
        Object.values(groups).forEach(arr => arr.sort((a, b) =>
            new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
        ));
        return groups;
    }, [yearAusencias]);

    // Stats for the selected year
    const yearStats = useMemo(() => {
        const approved = yearAusencias.filter(a => a.estado === 'APROBADA');

        const vacDays = approved
            .filter(a => a.tipo === 'VACACIONES')
            .reduce((acc, a) => acc + differenceInCalendarDays(new Date(a.fechaFin), new Date(a.fechaInicio)) + 1, 0);

        const bajaDays = approved
            .filter(a => a.tipo === 'BAJA')
            .reduce((acc, a) => acc + differenceInCalendarDays(new Date(a.fechaFin), new Date(a.fechaInicio)) + 1, 0);

        const permisoDays = approved
            .filter(a => a.tipo === 'PERMISO')
            .reduce((acc, a) => acc + differenceInCalendarDays(new Date(a.fechaFin), new Date(a.fechaInicio)) + 1, 0);

        const otrosDays = approved
            .filter(a => a.tipo !== 'VACACIONES' && a.tipo !== 'BAJA' && a.tipo !== 'PERMISO')
            .reduce((acc, a) => acc + differenceInCalendarDays(new Date(a.fechaFin), new Date(a.fechaInicio)) + 1, 0);

        const pendingCount = yearAusencias.filter(a => a.estado === 'PENDIENTE').length;
        const deniedCount = yearAusencias.filter(a => a.estado === 'DENEGADA').length;
        const totalRecords = yearAusencias.length;

        return { vacDays, bajaDays, permisoDays, otrosDays, pendingCount, deniedCount, totalRecords };
    }, [yearAusencias]);

    // Yearly balance for vacations (use current data for current year, or calculate for past years)
    const totalVac = employee.totalVacaciones + employee.diasExtras;
    const usedVac = selectedYear === currentYear ? employee.diasDisfrutados : yearStats.vacDays;
    const remainingVac = totalVac - usedVac;
    const pctUsed = totalVac > 0 ? Math.min((usedVac / totalVac) * 100, 100) : 0;

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-5 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold leading-tight">{employee.nombre}</h2>
                                <p className="text-xs text-indigo-200 uppercase font-medium">{employee.rol}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Year selector */}
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => {
                                const idx = availableYears.indexOf(selectedYear);
                                if (idx < availableYears.length - 1) setSelectedYear(availableYears[idx + 1]);
                            }}
                            disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex gap-1.5">
                            {availableYears.map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-3.5 py-1.5 rounded-full text-sm font-bold transition-all ${
                                        selectedYear === year
                                            ? 'bg-white text-indigo-700 shadow-md'
                                            : 'text-indigo-200 hover:bg-white/15'
                                    }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => {
                                const idx = availableYears.indexOf(selectedYear);
                                if (idx > 0) setSelectedYear(availableYears[idx - 1]);
                            }}
                            disabled={availableYears.indexOf(selectedYear) <= 0}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto">

                    {/* Vacation Balance Card */}
                    <div className="p-4 border-b bg-gradient-to-b from-blue-50 to-white">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-blue-500" />
                            Balance Vacaciones {selectedYear}
                        </h3>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm">
                                <p className="text-2xl font-black text-gray-800">{totalVac}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Total</p>
                            </div>
                            <div className="bg-white border border-blue-200 rounded-xl p-3 text-center shadow-sm">
                                <p className="text-2xl font-black text-blue-600">{usedVac}</p>
                                <p className="text-[10px] text-blue-500 font-medium uppercase">Usados</p>
                            </div>
                            <div className={`rounded-xl p-3 text-center shadow-sm border ${
                                remainingVac > 5 ? 'bg-green-50 border-green-200' : remainingVac > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                            }`}>
                                <p className={`text-2xl font-black ${
                                    remainingVac > 5 ? 'text-green-600' : remainingVac > 0 ? 'text-amber-600' : 'text-red-600'
                                }`}>{remainingVac}</p>
                                <p className="text-[10px] text-gray-500 font-medium uppercase">Disponibles</p>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ease-out ${
                                    pctUsed > 90 ? 'bg-red-500' : pctUsed > 70 ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${pctUsed}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">{pctUsed.toFixed(0)}% consumido</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="p-4 border-b">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                            Resumen por Tipo
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { tipo: 'VACACIONES', days: yearStats.vacDays },
                                { tipo: 'BAJA', days: yearStats.bajaDays },
                                { tipo: 'PERMISO', days: yearStats.permisoDays },
                                { tipo: 'OTROS', days: yearStats.otrosDays },
                            ].map(item => {
                                const cfg = TYPE_CONFIG[item.tipo] || TYPE_CONFIG.OTROS;
                                const Icon = cfg.icon;
                                return (
                                    <div key={item.tipo} className={`${cfg.bgLight} border ${cfg.borderColor} rounded-xl p-3 flex items-center gap-3`}>
                                        <div className={`p-2 rounded-lg ${cfg.bgBadge}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className={`text-xl font-black ${cfg.textColor}`}>{item.days}</p>
                                            <p className="text-[10px] text-gray-500 font-medium">{cfg.label} (días)</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pending / Denied indicators */}
                        {(yearStats.pendingCount > 0 || yearStats.deniedCount > 0) && (
                            <div className="flex gap-2 mt-3">
                                {yearStats.pendingCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                                        <Clock className="w-3 h-3" /> {yearStats.pendingCount} pendiente{yearStats.pendingCount > 1 ? 's' : ''}
                                    </div>
                                )}
                                {yearStats.deniedCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                                        <XCircle className="w-3 h-3" /> {yearStats.deniedCount} denegada{yearStats.deniedCount > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Timeline by Month */}
                    <div className="p-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            Detalle por Mes
                        </h3>

                        {yearStats.totalRecords === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                                <p className="font-medium">No hay registros en {selectedYear}</p>
                                <p className="text-sm mt-1">No existen solicitudes para este año.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {Object.keys(monthlyGroups)
                                    .map(Number)
                                    .sort((a, b) => a - b)
                                    .map(monthIdx => {
                                        const absences = monthlyGroups[monthIdx];
                                        const totalMonthDays = absences
                                            .filter(a => a.estado === 'APROBADA')
                                            .reduce((acc, a) => acc + differenceInCalendarDays(new Date(a.fechaFin), new Date(a.fechaInicio)) + 1, 0);

                                        return (
                                            <div key={monthIdx}>
                                                {/* Month Header */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <span className="text-xs font-black text-gray-600">{MONTH_NAMES[monthIdx].substring(0, 3).toUpperCase()}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-gray-700">{MONTH_NAMES[monthIdx]}</p>
                                                    </div>
                                                    <span className="text-xs text-gray-400 font-medium">
                                                        {absences.length} registro{absences.length > 1 ? 's' : ''} · {totalMonthDays} día{totalMonthDays !== 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                {/* Absence Items */}
                                                <div className="ml-4 border-l-2 border-gray-200 pl-4 space-y-2">
                                                    {absences.map(absence => {
                                                        const cfg = TYPE_CONFIG[absence.tipo] || TYPE_CONFIG.OTROS;
                                                        const statusCfg = STATUS_CONFIG[absence.estado] || STATUS_CONFIG.PENDIENTE;
                                                        const Icon = cfg.icon;
                                                        const StatusIcon = statusCfg.icon;
                                                        const dias = differenceInCalendarDays(new Date(absence.fechaFin), new Date(absence.fechaInicio)) + 1;
                                                        const isOngoing = absence.estado === 'APROBADA' &&
                                                            new Date(absence.fechaInicio) <= new Date() &&
                                                            new Date(absence.fechaFin) >= new Date();

                                                        return (
                                                            <div
                                                                key={absence.id}
                                                                className={`${cfg.bgLight} border ${cfg.borderColor} rounded-lg p-3 transition-all hover:shadow-sm relative`}
                                                            >
                                                                {/* Dot on timeline */}
                                                                <div
                                                                    className="absolute -left-[1.35rem] top-4 w-2.5 h-2.5 rounded-full border-2 border-white"
                                                                    style={{ backgroundColor: cfg.color }}
                                                                />

                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className={`p-1 rounded ${cfg.bgBadge} shrink-0`}>
                                                                            <Icon className="w-3.5 h-3.5" />
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className={`text-sm font-bold ${cfg.textColor} flex items-center gap-1.5`}>
                                                                                {cfg.label}
                                                                                {absence.horas && <span className="text-xs font-normal text-gray-500">({absence.horas}h)</span>}
                                                                                {isOngoing && (
                                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                                                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                                                                        Ahora
                                                                                    </span>
                                                                                )}
                                                                            </p>
                                                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5">
                                                                                <span className="font-medium">
                                                                                    {format(new Date(absence.fechaInicio), "d MMM", { locale: es })}
                                                                                </span>
                                                                                {absence.fechaInicio !== absence.fechaFin && (
                                                                                    <>
                                                                                        <ArrowRight className="w-2.5 h-2.5 text-gray-400" />
                                                                                        <span className="font-medium">
                                                                                            {format(new Date(absence.fechaFin), "d MMM", { locale: es })}
                                                                                        </span>
                                                                                    </>
                                                                                )}
                                                                                <span className="text-gray-400 bg-white/80 px-1.5 py-0.5 rounded text-[10px] border">
                                                                                    {dias}d
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusCfg.badge}`}>
                                                                        <StatusIcon className="w-3 h-3" />
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </div>

                                                                {absence.observaciones && (
                                                                    <p className="text-xs text-gray-500 italic mt-1.5 ml-7 truncate">
                                                                        "{absence.observaciones}"
                                                                    </p>
                                                                )}

                                                                {absence.justificanteUrl && (
                                                                    <a
                                                                        href={absence.justificanteUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1.5 ml-7"
                                                                    >
                                                                        <FileText className="w-3 h-3" /> Ver justificante
                                                                    </a>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    {/* Compensaciones (if any) */}
                    {employee.compensaciones && employee.compensaciones.length > 0 && (
                        <div className="p-4 border-t bg-amber-50/50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                                Compensaciones Festivos
                            </h3>
                            <div className="space-y-2">
                                {employee.compensaciones.map(comp => (
                                    <div key={comp.id} className="bg-white border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{comp.fiesta?.nombre}</p>
                                            <p className="text-xs text-gray-500">
                                                {comp.fiesta?.fecha && format(new Date(comp.fiesta.fecha), 'd MMM yyyy', { locale: es })}
                                                {' · '}{comp.motivo}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-amber-700">
                                                +{comp.valor} {comp.tipo === 'DIA_VACACIONES' ? 'día' : 'h'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t p-4 bg-gray-50 shrink-0">
                    <Button variant="outline" onClick={onClose} className="w-full">
                        Cerrar
                    </Button>
                </div>
            </div>
        </>
    );
}
