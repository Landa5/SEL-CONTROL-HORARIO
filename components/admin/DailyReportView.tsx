/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Truck, Wrench, Briefcase, Calendar, AlertTriangle, ArrowRight } from 'lucide-react';

export default function DailyReportView() {
    const [date, setDate] = useState(new Date());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDailyReport();
    }, [date]);

    const fetchDailyReport = async () => {
        setLoading(true);
        try {
            const formattedDate = format(date, 'yyyy-MM-dd');
            const res = await fetch(`/api/admin/informes/operativo-diario?date=${formattedDate}`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch (error) {
            console.error("Error fetching daily report", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (offset: number) => {
        const newDate = new Date(date);
        newDate.setDate(newDate.getDate() + offset);
        setDate(newDate);
    };

    if (loading && !data) return <div className="p-12 text-center text-gray-400 animate-pulse">Generando Informe Diario...</div>;

    const { summary, conductores, mecanicos, oficina, empleados, riesgos, jornadaPartida } = data || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* DATE CONTROLS */}
            <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Informe Operativo Diario</h2>
                    <p className="text-sm text-slate-500">Segmentación por rol y análisis de productividad</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-lg border">
                    <Button variant="ghost" size="sm" onClick={() => handleDateChange(-1)}>Anterior</Button>
                    <div className="font-mono font-bold text-slate-700 w-32 text-center">
                        {format(date, 'dd MMM yyyy', { locale: es })}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDateChange(1)}>Siguiente</Button>
                </div>
            </div>

            {/* EXECUTIVE SUMMARY */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard label="Personal Activo" value={summary.totalEmpleados} icon={Users} color="slate" />
                <SummaryCard label="Conductores en Ruta" value={summary.conductoresRuta} icon={Truck} color="blue" />
                {/* Mecánico split logic could be better visualized, but summary is fine */}
                <SummaryCard label="Mecánicos (Taller/Ruta)" value={`${summary.mecanicoTaller} / ${summary.mecanicoRuta}`} icon={Wrench} color="orange" />
                <SummaryCard label="KM Totales" value={summary.kmTotales} unit="km" icon={Truck} color="emerald" />
            </div>

            {/* RISKS & ALERTS */}
            {riesgos.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <h3 className="font-bold text-red-800 uppercase text-sm tracking-wider">Riesgos Operativos Detectados</h3>
                    </div>
                    <div className="space-y-2">
                        {riesgos.map((r: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{r.severidad}</span>
                                <div>
                                    <span className="font-bold text-gray-900 text-sm mr-2">{r.empleado} ({r.rol}):</span>
                                    <span className="text-gray-600 text-sm">{r.mensaje}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTIONS BY ROLE */}

            {/* 1. CONDUCTORES */}
            <SectionHeader title="Conductores" icon={Truck} count={conductores.length} />
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Conductor</th>
                                <th className="px-6 py-3">Horario</th>
                                <th className="px-6 py-3 text-right">Conducción</th>
                                <th className="px-6 py-3 text-right">KM</th>
                                <th className="px-6 py-3 text-right">Media KM/H</th>
                                <th className="px-6 py-3 text-right">Descargas</th>
                                <th className="px-6 py-3 text-right">Utilización</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {conductores.map((c: any) => (
                                <tr key={c.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 font-bold text-gray-900">{c.nombre}</td>
                                    <td className="px-6 py-3 text-mono text-gray-600">{c.horaEntrada} - {c.horaSalida}</td>
                                    <td className="px-6 py-3 text-right font-mono">{c.conduccionHoras} h</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-800">{c.km}</td>
                                    <td className="px-6 py-3 text-right font-mono text-slate-500">{c.kmh}</td>
                                    <td className="px-6 py-3 text-right font-mono">{c.descargas}</td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-xs font-bold text-gray-600">{c.utilizacion}</span>
                                            {/* Simple visual bar */}
                                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: c.utilizacion }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {conductores.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-6 text-gray-400 italic">No hay conductores registrados hoy</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* 2. MECÁNICOS */}
            <SectionHeader title="Mecánicos / Taller" icon={Wrench} count={mecanicos.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mecanicos.map((m: any) => (
                    <Card key={m.id} className="overflow-hidden">
                        <CardHeader className="bg-slate-50 pb-2 border-b">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-sm font-black uppercase text-slate-800">{m.nombre}</CardTitle>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${m.actividad.includes('Ruta') ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {m.actividad}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Tiempo Taller</p>
                                <p className="text-xl font-mono text-slate-700">{m.tallerHoras}h</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Tiempo Ruta</p>
                                <p className="text-xl font-mono text-orange-600">{m.conduccionHoras}h</p>
                            </div>
                            {m.km > 0 && (
                                <div className="col-span-2 bg-orange-50 p-2 rounded text-xs text-orange-800 font-medium">
                                    <Truck className="w-3 h-3 inline mr-1" /> Ha realizado {m.km} km en prueba/ruta.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
                {mecanicos.length === 0 && <p className="text-gray-400 italic text-sm p-4 col-span-2">No hay actividad de mecánicos hoy.</p>}
            </div>

            {/* 3. OFICINA & EMPLEADOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <SectionHeader title="Oficina" icon={Briefcase} count={oficina.length} />
                    <Card>
                        <div className="divide-y">
                            {oficina.map((o: any) => (
                                <div key={o.id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">{o.nombre}</p>
                                        <p className="text-xs text-gray-500">{o.horas} horas registradas</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                            {o.tareas} Tareas
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {oficina.length === 0 && <div className="p-4 text-gray-400 text-sm italic">Sin datos de oficina.</div>}
                        </div>
                    </Card>
                </div>
                <div>
                    <SectionHeader title="Otros Empleados" icon={Users} count={empleados.length} />
                    <Card>
                        <div className="divide-y">
                            {empleados.map((e: any) => (
                                <div key={e.id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">{e.nombre}</p>
                                        <p className="text-xs text-gray-500">{e.horas} horas registradas</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                            {e.tareas} Tareas
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {empleados.length === 0 && <div className="p-4 text-gray-400 text-sm italic">Sin datos de otros empleados.</div>}
                        </div>
                    </Card>
                </div>
            </div>

        </div>
    );
}

function SummaryCard({ label, value, unit, icon: Icon, color }: any) {
    const colorClasses: any = {
        slate: 'bg-slate-50 text-slate-700',
        blue: 'bg-blue-50 text-blue-700',
        orange: 'bg-orange-50 text-orange-700',
        emerald: 'bg-emerald-50 text-emerald-700',
    };

    return (
        <Card>
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-gray-900">{value}</span>
                        {unit && <span className="text-sm font-medium text-gray-500">{unit}</span>}
                    </div>
                </div>
                <div className={`p-3 rounded-xl ${colorClasses[color] || 'bg-gray-100'}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </CardContent>
        </Card>
    )
}

function SectionHeader({ title, icon: Icon, count }: any) {
    return (
        <div className="flex items-center gap-2 mb-4 mt-2">
            <div className="bg-white p-2 border rounded-lg shadow-sm">
                <Icon className="w-4 h-4 text-gray-700" />
            </div>
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">{title}</h3>
            {count !== undefined && (
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
            )}
        </div>
    )
}
