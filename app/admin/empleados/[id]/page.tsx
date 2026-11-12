'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
    User,
    Clock,
    Calendar,
    Euro,
    BookOpen,
    AlertTriangle,
    FileText,
    Truck,
    Phone,
    Mail,
    ShieldCheck,
    ArrowLeft,
    BarChart2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import DocumentManager from '@/components/documents/DocumentManager';
import { format } from 'date-fns';

export default function Empleado360Page(props: { params: Promise<{ id: string }> }) {
    const { id } = use(props.params);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'RESUMEN' | 'JORNADAS' | 'AUSENCIAS' | 'NOMINAS' | 'FORMACION' | 'DOCUMENTOS'>(
        'RESUMEN'
    );

    useEffect(() => {
        fetch(`/api/admin/empleados/${id}/360`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => setData(d))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="p-12 text-center text-slate-500 animate-pulse">Cargando Ficha 360° del Empleado...</div>;
    }

    if (!data?.empleado) {
        return (
            <div className="p-12 text-center space-y-4">
                <p className="text-slate-600 font-bold">Empleado no encontrado</p>
                <Link href="/admin/empleados">
                    <Button variant="outline">Volver a Empleados</Button>
                </Link>
            </div>
        );
    }

    const { empleado: emp, kpisAnuales: kpis, tachoDriver } = data;
    const perf = emp.perfilProfesional;

    const getExpBadge = (dateStr: string | null, label: string) => {
        if (!dateStr) return <span className="px-2 py-1 rounded bg-slate-100 text-slate-400 text-xs">{label}: ---</span>;
        const d = new Date(dateStr);
        const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const color =
            days < 0
                ? 'bg-red-100 text-red-800 border-red-300'
                : days <= 30
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200';
        return (
            <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${color}`}>
                {label}: {format(d, 'dd/MM/yyyy')} ({days < 0 ? 'CADUCADO' : `${days}d`})
            </span>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header Profile Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-2xl font-black shrink-0 shadow-md">
                            {emp.nombre?.charAt(0) || 'E'}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-black text-slate-900">
                                    {emp.nombre} {emp.apellidos}
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                    {emp.rol}
                                </span>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                        emp.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}
                                >
                                    {emp.activo ? 'ACTIVO' : 'BAJA'}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                                <span className="font-mono">DNI: {emp.dni || '---'}</span>
                                <span>Usuario: @{emp.usuario}</span>
                                {emp.telefono && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5" /> {emp.telefono}
                                    </span>
                                )}
                                {emp.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-3.5 h-3.5" /> {emp.email}
                                    </span>
                                )}
                            </div>
                            {perf && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {getExpBadge(perf.dniCaducidad, 'DNI')}
                                    {getExpBadge(perf.carnetCaducidad, `Carnet ${perf.carnetTipo || ''}`)}
                                    {perf.tieneAdr && getExpBadge(perf.adrCaducidad, 'ADR')}
                                    {perf.capCaducidad && getExpBadge(perf.capCaducidad, 'CAP')}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/admin/empleados">
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                <ArrowLeft className="w-3.5 h-3.5" /> Volver al listado
                            </Button>
                        </Link>
                        <Link href="/admin/informes/mensuales">
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs">
                                <BarChart2 className="w-3.5 h-3.5" /> Informe Mensual y Nómina
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Annual KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-5 border-t border-slate-100">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Jornadas ({kpis.year})</p>
                        <p className="text-xl font-black text-slate-900">{kpis.jornadasCount}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                        <p className="text-[10px] font-bold uppercase text-blue-600">Horas Totales</p>
                        <p className="text-xl font-black text-blue-950">{kpis.horas} h</p>
                    </div>
                    <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                        <p className="text-[10px] font-bold uppercase text-indigo-600">KM Recorridos</p>
                        <p className="text-xl font-black text-indigo-950">{kpis.km.toLocaleString('es-ES')} km</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <p className="text-[10px] font-bold uppercase text-emerald-600">Descargas / Viajes</p>
                        <p className="text-xl font-black text-emerald-950">
                            {kpis.descargas} / {kpis.viajes}
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                        <p className="text-[10px] font-bold uppercase text-amber-700">Consumo Medio</p>
                        <p className="text-xl font-black text-amber-950">{kpis.consumoMedio} L/100</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                        <p className="text-[10px] font-bold uppercase text-purple-700">Vacaciones Pend.</p>
                        <p className="text-xl font-black text-purple-950">
                            {kpis.vacacionesPendientes} <span className="text-xs font-normal">/ {kpis.vacacionesTotales}d</span>
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                        <p className="text-[10px] font-bold uppercase text-rose-700">Días Ausencia</p>
                        <p className="text-xl font-black text-rose-950">{kpis.diasAusencia} d</p>
                    </div>
                </div>
            </div>

            {/* 360° Navigation Tabs */}
            <div className="bg-white border rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto shadow-2xs">
                {[
                    { id: 'RESUMEN', label: 'Resumen 360° y Horario', icon: User },
                    { id: 'JORNADAS', label: `Jornadas y Rutas (${emp.jornadas?.length || 0})`, icon: Clock },
                    { id: 'AUSENCIAS', label: `Ausencias y Vacaciones (${emp.ausencias?.length || 0})`, icon: Calendar },
                    { id: 'NOMINAS', label: `Nóminas (${emp.nominas?.length || 0})`, icon: Euro },
                    { id: 'FORMACION', label: `Formación e Incidencias`, icon: BookOpen },
                    { id: 'DOCUMENTOS', label: `Documentos (${emp.documentos?.length || 0})`, icon: FileText }
                ].map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                tab === t.id
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: RESUMEN */}
            {tab === 'RESUMEN' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-600" /> Configuración Horaria y Puesto
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-slate-500">Puesto / Categoría:</span>
                                <span className="font-bold text-slate-800">{emp.puestoTrabajo || emp.rol}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-slate-500">Turno Mañana:</span>
                                <span className="font-mono font-bold">
                                    {emp.horaEntradaPrevista || '08:00'} - {emp.horaSalidaPrevista || '14:00'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b">
                                <span className="text-slate-500">Turno Tarde:</span>
                                <span className="font-mono font-bold">
                                    {emp.horaEntradaTarde || '15:00'} - {emp.horaSalidaTarde || '18:00'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-slate-500">Tarjeta Tacógrafo Vinculada:</span>
                                <span className="font-mono font-bold text-indigo-700">
                                    {tachoDriver ? `${tachoDriver.fullName} (${tachoDriver.cardNumber})` : 'No vinculada'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" /> Últimas Incidencias / Partes Reportados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {emp.tareasCreadas?.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-4">
                                    Este empleado no ha reportado incidencias recientemente.
                                </p>
                            ) : (
                                <div className="divide-y">
                                    {emp.tareasCreadas.slice(0, 6).map((t: any) => (
                                        <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-bold text-slate-800">{t.titulo}</p>
                                                <p className="text-slate-400">
                                                    {t.camion?.matricula || t.matricula || 'General'} ·{' '}
                                                    {format(new Date(t.createdAt), 'dd/MM/yyyy')}
                                                </p>
                                            </div>
                                            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                                                {t.estado}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 2: JORNADAS */}
            {tab === 'JORNADAS' && (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Entrada</th>
                                    <th className="p-4">Salida</th>
                                    <th className="p-4 text-right">Horas</th>
                                    <th className="p-4">Camión</th>
                                    <th className="p-4 text-right">KM</th>
                                    <th className="p-4 text-right">Descargas</th>
                                    <th className="p-4 text-right">Viajes</th>
                                    <th className="p-4 text-right">Litros</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {emp.jornadas.map((j: any) => {
                                    const km = (j.usosCamion || []).reduce(
                                        (acc: number, u: any) =>
                                            acc +
                                            (u.kmRecorridos ||
                                                (u.kmFinal && u.kmInicial ? Math.max(0, u.kmFinal - u.kmInicial) : 0)),
                                        0
                                    );
                                    const desc = (j.usosCamion || []).reduce(
                                        (acc: number, u: any) => acc + (u.descargasCount || 0),
                                        0
                                    );
                                    const viaj = (j.usosCamion || []).reduce(
                                        (acc: number, u: any) => acc + (u.viajesCount || 0),
                                        0
                                    );
                                    const lit = (j.usosCamion || []).reduce(
                                        (acc: number, u: any) => acc + (u.litrosRepostados || 0),
                                        0
                                    );
                                    const mats = (j.usosCamion || [])
                                        .map((u: any) => u.camion?.matricula)
                                        .filter(Boolean)
                                        .join(', ');

                                    return (
                                        <tr key={j.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold">{format(new Date(j.fecha), 'dd/MM/yyyy')}</td>
                                            <td className="p-4 font-mono text-xs">
                                                {format(new Date(j.horaEntrada), 'HH:mm')}
                                            </td>
                                            <td className="p-4 font-mono text-xs">
                                                {j.horaSalida ? format(new Date(j.horaSalida), 'HH:mm') : 'En curso'}
                                            </td>
                                            <td className="p-4 text-right font-bold text-blue-700">
                                                {j.totalHoras ? `${Number(j.totalHoras).toFixed(2)} h` : '-'}
                                            </td>
                                            <td className="p-4 font-mono text-xs">{mats || '---'}</td>
                                            <td className="p-4 text-right font-mono">{km} km</td>
                                            <td className="p-4 text-right font-mono">{desc}</td>
                                            <td className="p-4 text-right font-mono">{viaj}</td>
                                            <td className="p-4 text-right font-mono">{lit > 0 ? `${lit} L` : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 3: AUSENCIAS */}
            {tab === 'AUSENCIAS' && (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                                <tr>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4">Desde</th>
                                    <th className="p-4">Hasta</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4">Motivo / Observaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {emp.ausencias.map((a: any) => (
                                    <tr key={a.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold text-slate-800">{a.tipo}</td>
                                        <td className="p-4">{format(new Date(a.fechaInicio), 'dd/MM/yyyy')}</td>
                                        <td className="p-4">{format(new Date(a.fechaFin), 'dd/MM/yyyy')}</td>
                                        <td className="p-4">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    a.estado === 'APROBADA'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : a.estado === 'PENDIENTE'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-rose-100 text-rose-800'
                                                }`}
                                            >
                                                {a.estado}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">{a.motivo || '---'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 4: NOMINAS */}
            {tab === 'NOMINAS' && (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                                <tr>
                                    <th className="p-4">Periodo</th>
                                    <th className="p-4">Estado</th>
                                    <th className="p-4 text-right">Total Variables (€)</th>
                                    <th className="p-4">Detalle Conceptos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {emp.nominas.map((n: any) => (
                                    <tr key={n.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-bold">
                                            {String(n.month).padStart(2, '0')}/{n.year}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                    n.estado === 'CERRADA'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}
                                            >
                                                {n.estado}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-black text-slate-900">
                                            {Number(n.totalVariables || 0).toFixed(2)} €
                                        </td>
                                        <td className="p-4 text-xs text-slate-600">
                                            {(n.lineas || [])
                                                .map((l: any) => `${l.conceptoNombre}: ${Number(l.importe).toFixed(2)}€`)
                                                .join(' · ')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 5: FORMACION */}
            {tab === 'FORMACION' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Módulos de Formación Realizados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(emp.resultadosFormacion || emp.progresoFormacion || []).length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sin cursos registrados.</p>
                            ) : (
                                <div className="divide-y">
                                    {(emp.resultadosFormacion || emp.progresoFormacion || []).map((pf: any) => (
                                        <div key={pf.id} className="py-2.5 flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800">{pf.modulo?.titulo}</span>
                                            <span
                                                className={`px-2 py-0.5 rounded font-bold ${
                                                    pf.aprobado || pf.completado
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}
                                            >
                                                {pf.aprobado || pf.completado
                                                    ? `Completado (${pf.puntuacion ?? 100} pts)`
                                                    : 'En progreso'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Evaluaciones de Desempeño</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {emp.evaluacionesRecibidas?.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sin evaluaciones registradas.</p>
                            ) : (
                                <div className="divide-y">
                                    {emp.evaluacionesRecibidas.map((ev: any) => (
                                        <div key={ev.id} className="py-2.5 flex items-center justify-between text-xs">
                                            <div>
                                                <p className="font-bold text-slate-800">{ev.periodo || 'Evaluación'}</p>
                                                <p className="text-slate-400">{ev.comentarios || ''}</p>
                                            </div>
                                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                                                Nota: {ev.puntuacionGlobal}/10
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 6: DOCUMENTOS */}
            {tab === 'DOCUMENTOS' && (
                <Card>
                    <CardContent className="p-6">
                        <DocumentManager entityId={emp.id} entityType="EMPLEADO" />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
