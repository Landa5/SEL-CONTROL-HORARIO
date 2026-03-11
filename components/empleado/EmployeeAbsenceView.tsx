"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import AbsenceForm from '@/components/ausencias/AbsenceForm';
import {
    Calendar,
    Plus,
    Clock,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    FileText,
    Sun,
    Thermometer,
    ArrowRight,
    Filter
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';

export default function EmployeeAbsenceView() {
    const [ausencias, setAusencias] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<'TODAS' | 'PENDIENTE' | 'APROBADA' | 'DENEGADA'>('TODAS');

    useEffect(() => {
        fetchAll();
    }, []);

    async function fetchAll() {
        setLoading(true);
        try {
            const [absRes, statsRes] = await Promise.all([
                fetch('/api/ausencias'),
                fetch('/api/ausencias/stats?me=true')
            ]);
            if (absRes.ok) setAusencias(await absRes.json());
            if (statsRes.ok) {
                const data = await statsRes.json();
                if (data && data.length > 0) setStats(data[0]);
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    }

    const filtered = ausencias.filter(a => filter === 'TODAS' || a.estado === filter);

    const pendientes = ausencias.filter(a => a.estado === 'PENDIENTE').length;
    const aprobadas = ausencias.filter(a => a.estado === 'APROBADA').length;

    const safeStats = stats || { totalVacaciones: 0, diasDisfrutados: 0, diasRestantes: 0, diasExtras: 0 };
    const totalDias = (safeStats.totalVacaciones || 0) + (safeStats.diasExtras || 0);
    const pctUsed = totalDias > 0 ? Math.min((safeStats.diasDisfrutados / totalDias) * 100, 100) : 0;

    const getTypeConfig = (tipo: string) => {
        switch (tipo) {
            case 'VACACIONES': return { icon: Sun, color: 'blue', label: 'Vacaciones', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' };
            case 'BAJA': return { icon: Thermometer, color: 'orange', label: 'Baja Médica', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700' };
            case 'PERMISO': return { icon: FileText, color: 'purple', label: 'Permiso', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700' };
            default: return { icon: Calendar, color: 'gray', label: tipo, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-700' };
        }
    };

    const getStatusConfig = (estado: string, fechaFin: string) => {
        const isPast = new Date(fechaFin) < new Date();
        if (estado === 'PENDIENTE') return { icon: Clock, label: 'Pendiente', bg: 'bg-amber-50', border: 'border-l-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' };
        if (estado === 'APROBADA' && isPast) return { icon: CheckCircle, label: 'Disfrutada', bg: 'bg-gray-50', border: 'border-l-gray-300', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-500' };
        if (estado === 'APROBADA') return { icon: CheckCircle, label: 'Aprobada', bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-700' };
        if (estado === 'DENEGADA') return { icon: XCircle, label: 'Denegada', bg: 'bg-red-50', border: 'border-l-red-400', text: 'text-red-600', badge: 'bg-red-100 text-red-600' };
        return { icon: Calendar, label: estado, bg: 'bg-gray-50', border: 'border-l-gray-300', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-600' };
    };

    if (loading) return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
    );

    return (
        <div className="space-y-5">

            {/* ─── RESUMEN VACACIONES ─── */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-indigo-200" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-200">Mis Vacaciones {new Date().getFullYear()}</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                        <p className="text-3xl font-black">{totalDias}</p>
                        <p className="text-xs text-indigo-200 font-medium">Total</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-black">{safeStats.diasDisfrutados}</p>
                        <p className="text-xs text-indigo-200 font-medium">Usados</p>
                    </div>
                    <div className="text-center bg-white/10 rounded-xl py-1">
                        <p className="text-3xl font-black text-white">{safeStats.diasRestantes}</p>
                        <p className="text-xs text-indigo-200 font-bold">Disponibles</p>
                    </div>
                </div>
                {/* Barra de progreso */}
                <div className="bg-white/20 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-white h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pctUsed}%` }}
                    />
                </div>
                <p className="text-xs text-indigo-200 mt-1.5 text-right">
                    {pctUsed.toFixed(0)}% usado
                </p>
            </div>

            {/* ─── BOTÓN NUEVA SOLICITUD ─── */}
            <Button
                onClick={() => setShowForm(!showForm)}
                className={`w-full font-bold text-base py-6 rounded-xl shadow-md transition-all ${showForm
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
            >
                {showForm ? (
                    <><ChevronUp className="w-5 h-5 mr-2" /> Cerrar Formulario</>
                ) : (
                    <><Plus className="w-5 h-5 mr-2" /> Nueva Solicitud</>
                )}
            </Button>

            {/* ─── FORMULARIO PLEGABLE ─── */}
            {showForm && (
                <Card className="border-2 border-blue-200 animate-in slide-in-from-top-2 duration-300">
                    <CardContent className="p-5">
                        <AbsenceForm onSuccess={() => { fetchAll(); setShowForm(false); }} onCancel={() => setShowForm(false)} />
                    </CardContent>
                </Card>
            )}

            {/* ─── FILTROS RÁPIDOS ─── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                {([
                    { key: 'TODAS', label: 'Todas', count: ausencias.length },
                    { key: 'PENDIENTE', label: 'Pendientes', count: pendientes },
                    { key: 'APROBADA', label: 'Aprobadas', count: aprobadas },
                    { key: 'DENEGADA', label: 'Denegadas', count: ausencias.filter(a => a.estado === 'DENEGADA').length },
                ] as const).map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === f.key
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {f.label} {f.count > 0 && <span className={`ml-1 ${filter === f.key ? 'text-blue-200' : 'text-gray-400'}`}>({f.count})</span>}
                    </button>
                ))}
            </div>

            {/* ─── LISTA DE SOLICITUDES (TARJETAS) ─── */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                        <p className="font-medium">No hay solicitudes {filter !== 'TODAS' ? 'con ese estado' : 'todavía'}</p>
                        {filter === 'TODAS' && <p className="text-sm mt-1">Pulsa "Nueva Solicitud" para crear una</p>}
                    </div>
                ) : (
                    filtered.map(ausencia => {
                        const type = getTypeConfig(ausencia.tipo);
                        const status = getStatusConfig(ausencia.estado, ausencia.fechaFin);
                        const StatusIcon = status.icon;
                        const TypeIcon = type.icon;
                        const dias = differenceInCalendarDays(new Date(ausencia.fechaFin), new Date(ausencia.fechaInicio)) + 1;
                        const isOngoing = ausencia.estado === 'APROBADA' && new Date(ausencia.fechaInicio) <= new Date() && new Date(ausencia.fechaFin) >= new Date();

                        return (
                            <div
                                key={ausencia.id}
                                className={`${status.bg} border ${status.border} border-l-4 rounded-xl p-4 transition-all hover:shadow-sm`}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-lg ${type.badge}`}>
                                            <TypeIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${type.text}`}>{type.label}</p>
                                            {ausencia.horas &&
                                                <span className="text-xs text-gray-500">({ausencia.horas}h parcial)</span>
                                            }
                                        </div>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${status.badge}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {status.label}
                                    </span>
                                </div>

                                {/* Fechas */}
                                <div className="flex items-center gap-2 text-sm text-gray-700 ml-1 mb-2">
                                    <span className="font-semibold">
                                        {format(new Date(ausencia.fechaInicio), "d MMM yyyy", { locale: es })}
                                    </span>
                                    {ausencia.fechaInicio !== ausencia.fechaFin && (
                                        <>
                                            <ArrowRight className="w-3 h-3 text-gray-400" />
                                            <span className="font-semibold">
                                                {format(new Date(ausencia.fechaFin), "d MMM yyyy", { locale: es })}
                                            </span>
                                        </>
                                    )}
                                    <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border">
                                        {dias} {dias === 1 ? 'día' : 'días'}
                                    </span>
                                </div>

                                {/* En curso badge */}
                                {isOngoing && (
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg w-fit mb-2">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        En curso ahora
                                    </div>
                                )}

                                {/* Footer info */}
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                    {ausencia.observaciones && (
                                        <span className="italic truncate max-w-[200px]">"{ausencia.observaciones}"</span>
                                    )}
                                    {ausencia.justificanteUrl && (
                                        <a href={ausencia.justificanteUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-700 flex items-center gap-1 shrink-0">
                                            <FileText className="w-3 h-3" /> Justificante
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
