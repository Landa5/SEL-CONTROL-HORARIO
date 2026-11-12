'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
    Truck,
    Droplet,
    Activity,
    ArrowLeft,
    Fuel,
    Wrench,
    FileText,
    Euro,
    ShieldCheck,
    ClipboardCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import DocumentManager from '@/components/documents/DocumentManager';

export default function DetalleCamionPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    // Date State (Defaults to current month)
    const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [toDate, setToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'RESUMEN' | 'RUTAS' | 'TALLER' | 'MANT_CONDUCTOR' | 'DOCUMENTOS'>('RESUMEN');

    useEffect(() => {
        if (id) fetchStats();
    }, [id, fromDate, toDate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/camiones/${id}/estadisticas?from=${fromDate}&to=${toDate}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Cargando Ficha 360° del Camión...</div>;
    if (!data) return <div className="p-8 text-center">No se encontraron datos.</div>;

    const { camion, totales, diario, registros, tareas = [], mantenimientosConductor = [] } = data;
    const maxKm = Math.max(...(diario || []).map((d: any) => d.km), 100);

    const getExpBadge = (dateStr: string | null, label: string) => {
        if (!dateStr) return <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-400 text-xs">{label}: ---</span>;
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
            {/* HEADER 360° */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                        <Button variant="ghost" onClick={() => router.push('/admin/camiones')}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="p-3.5 rounded-2xl bg-blue-600 text-white shadow-md">
                            <Truck className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-2xl font-black text-slate-900 font-mono">{camion.matricula}</h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                    {camion.estado || 'DISPONIBLE'}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    Odómetro: {(camion.kmActual || 0).toLocaleString('es-ES')} km
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {camion.marca} {camion.modelo} • Bastidor/VIN: {camion.nVin || 'Sin especificar'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {getExpBadge(camion.itvVencimiento, 'ITV')}
                                {getExpBadge(camion.seguroVencimiento, 'Seguro')}
                                {getExpBadge(camion.tacografoVencimiento, 'Tacógrafo')}
                                {getExpBadge(camion.adrVencimiento, 'ADR')}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            className="bg-orange-600 hover:bg-orange-700 text-white shadow-sm text-xs"
                            onClick={() => router.push(`/admin/tareas?q=${camion.matricula}`)}
                        >
                            <Wrench className="w-4 h-4 mr-1.5" />
                            Taller / Averías
                        </Button>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border text-xs">
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="px-2 py-1 border rounded bg-white text-xs"
                            />
                            <span className="text-gray-400">a</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="px-2 py-1 border rounded bg-white text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* KPI CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-100">
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                        <p className="text-[10px] font-bold uppercase text-blue-600">KM Periodo</p>
                        <p className="text-xl font-black text-blue-950">{totales.km.toLocaleString('es-ES')} km</p>
                    </div>
                    <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-100">
                        <p className="text-[10px] font-bold uppercase text-orange-700">Consumo Medio</p>
                        <p className="text-xl font-black text-orange-950">{totales.consumoMedio} L/100</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                        <p className="text-[10px] font-bold uppercase text-purple-700">Litros Gasoil</p>
                        <p className="text-xl font-black text-purple-950">{totales.litros} L</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <p className="text-[10px] font-bold uppercase text-emerald-700">Viajes / Descargas</p>
                        <p className="text-xl font-black text-emerald-950">
                            {totales.viajes} / {totales.descargas}
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                        <p className="text-[10px] font-bold uppercase text-rose-700">Coste Taller Acum.</p>
                        <p className="text-xl font-black text-rose-950">{(totales.costeTaller || 0).toLocaleString('es-ES')} €</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-slate-600">Coste / KM Est.</p>
                        <p className="text-xl font-black text-slate-900">{(totales.costePorKm || 0).toFixed(2)} €/km</p>
                    </div>
                </div>
            </div>

            {/* 360° TABS */}
            <div className="bg-white border rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto shadow-2xs">
                {[
                    { id: 'RESUMEN', label: 'Resumen y Evolución', icon: Activity },
                    { id: 'RUTAS', label: `Rutas y Repostajes (${registros.length})`, icon: Fuel },
                    { id: 'TALLER', label: `Taller y Averías (${tareas.length})`, icon: Wrench },
                    {
                        id: 'MANT_CONDUCTOR',
                        label: `Mant. Conductores (${mantenimientosConductor.length})`,
                        icon: ClipboardCheck
                    },
                    { id: 'DOCUMENTOS', label: 'Documentos y Ficha Técnica', icon: FileText }
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
                <Card className="shadow-xs">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-gray-800">
                            Evolución Diaria de Kilómetros y Repostaje
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {diario.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">Sin actividad en este rango de fechas.</p>
                        ) : (
                            <div className="space-y-3">
                                {diario.map((day: any) => (
                                    <div key={day.date} className="space-y-1">
                                        <div className="flex justify-between text-xs text-gray-600">
                                            <span className="font-bold">
                                                {format(new Date(day.date), 'dd MMM yyyy')} ({day.conductores.join(', ')})
                                            </span>
                                            <span className="font-mono font-bold">
                                                {day.km} km {day.litros > 0 ? `• ${day.litros}L` : ''}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                                            <div
                                                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${(day.km / maxKm) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* TAB 2: RUTAS */}
            {tab === 'RUTAS' && (
                <Card className="shadow-xs">
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Conductor</th>
                                    <th className="px-4 py-3">Horario</th>
                                    <th className="px-4 py-3 text-right">KM Inicio</th>
                                    <th className="px-4 py-3 text-right">KM Fin</th>
                                    <th className="px-4 py-3 text-right">Total KM</th>
                                    <th className="px-4 py-3 text-center">Viajes / Desc.</th>
                                    <th className="px-4 py-3 text-right">Repostado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {registros.map((reg: any) => {
                                    const kmRec =
                                        reg.kmRecorridos ||
                                        (reg.kmFinal && reg.kmInicial ? Math.max(0, reg.kmFinal - reg.kmInicial) : 0);
                                    return (
                                        <tr key={reg.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3 font-medium">
                                                {format(new Date(reg.horaInicio), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {reg.jornada?.empleado
                                                    ? `${reg.jornada.empleado.nombre} ${reg.jornada.empleado.apellidos || ''}`
                                                    : 'Desconocido'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                                                {format(new Date(reg.horaInicio), 'HH:mm')} -{' '}
                                                {reg.horaFin ? format(new Date(reg.horaFin), 'HH:mm') : 'En curso'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-500">
                                                {reg.kmInicial}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-500">
                                                {reg.kmFinal || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600 font-mono">
                                                {kmRec > 0 ? `+${kmRec} km` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-xs">
                                                {reg.viajesCount || 0}v / {reg.descargasCount || 0}d
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {reg.litrosRepostados > 0 ? (
                                                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold text-xs">
                                                        {reg.litrosRepostados} L
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 3: TALLER Y AVERÍAS */}
            {tab === 'TALLER' && (
                <Card className="shadow-xs">
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Avería / Mantenimiento</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Prioridad</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3 text-right">Coste (€)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tareas.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 italic">
                                            Sin intervenciones de taller registradas para este vehículo.
                                        </td>
                                    </tr>
                                ) : (
                                    tareas.map((t: any) => (
                                        <tr key={t.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-xs">
                                                {format(new Date(t.createdAt), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-800">{t.titulo}</p>
                                                <p className="text-xs text-slate-400 truncate max-w-md">
                                                    {t.descripcion}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold">{t.tipo}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        t.prioridad === 'ALTA' || t.prioridad === 'URGENTE'
                                                            ? 'bg-red-100 text-red-800'
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    {t.prioridad}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        t.estado === 'COMPLETADA'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {t.estado}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold">
                                                {Number(t.costeTotal || t.costeEstimado || 0) > 0
                                                    ? `${Number(t.costeTotal || t.costeEstimado).toFixed(2)} €`
                                                    : '---'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 4: MANTENIMIENTO DE CONDUCTORES */}
            {tab === 'MANT_CONDUCTOR' && (
                <Card className="shadow-xs">
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Conductor</th>
                                    <th className="px-4 py-3">Aceite Motor</th>
                                    <th className="px-4 py-3">Hidráulico</th>
                                    <th className="px-4 py-3">Refrigerante</th>
                                    <th className="px-4 py-3">Lavado</th>
                                    <th className="px-4 py-3">Observaciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {mantenimientosConductor.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                                            Sin registros de mantenimiento diario por conductores.
                                        </td>
                                    </tr>
                                ) : (
                                    mantenimientosConductor.map((m: any) => (
                                        <tr key={m.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-xs font-bold">
                                                {format(new Date(m.fecha), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {m.empleado
                                                    ? `${m.empleado.nombre} ${m.empleado.apellidos || ''}`
                                                    : '---'}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {m.aceite ? `Sí (${m.litrosAceite || 0} L)` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{m.hidraulico ? 'Sí' : '-'}</td>
                                            <td className="px-4 py-3 text-xs">{m.refrigerante ? 'Sí' : '-'}</td>
                                            <td className="px-4 py-3 text-xs">{m.lavado ? 'Sí' : '-'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {m.observaciones || '---'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            {/* TAB 5: DOCUMENTOS */}
            {tab === 'DOCUMENTOS' && (
                <Card className="shadow-xs">
                    <CardContent className="p-6">
                        <DocumentManager entityId={camion.id} entityType="CAMION" />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
