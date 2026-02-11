'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    AlertTriangle,
    CheckCircle,
    Truck,
    Users,
    Clock,
    TrendingUp,
    Euro,
    Activity,
    Calendar,
    FileText,
    Wrench,
    ShieldAlert,
    ChevronRight,
    PlayCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/dashboard');
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando cuadro de mando...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Error cargando datos.</div>;

    const { section1, section2, section3, section4 } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">

            {/* SECTION 1: CRITICAL STATUS */}
            <section>
                {section1.isStable ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-4 shadow-sm">
                        <div className="bg-emerald-100 p-3 rounded-full">
                            <CheckCircle className="w-8 h-8 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-emerald-800 uppercase tracking-tight">Sistema Estable</h2>
                            <p className="text-emerald-700 font-medium">No hay alertas críticas, averías urgentes ni ausencias pendientes de revisión.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-red-100 p-2 rounded-full animate-pulse">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <h2 className="text-xl font-black text-red-800 uppercase tracking-tight">Atención Requerida</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Critical Tasks */}
                            {section1.criticalTasks.map((t: any) => (
                                <div key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="bg-white p-4 rounded-lg border border-red-100 shadow-sm cursor-pointer hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded">Avería / Urgente</span>
                                        <span className="text-xs text-gray-400">#{t.id}</span>
                                    </div>
                                    <p className="font-bold text-gray-900 mt-2">{t.titulo}</p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                        <Truck className="w-3 h-3" /> {t.matricula || 'General'}
                                    </p>
                                </div>
                            ))}
                            {/* Critical Absences */}
                            {section1.criticalAbsences.map((a: any) => (
                                <div key={a.id} onClick={() => router.push('/admin/ausencias')} className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm cursor-pointer hover:shadow-md transition-all">
                                    <span className="text-xs font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded">Ausencia Pendiente</span>
                                    <p className="font-bold text-gray-900 mt-2">{a.empleado.nombre} {a.empleado.apellidos}</p>
                                    <p className="text-sm text-gray-500 mt-1">Requiere aprobación inmediata</p>
                                </div>
                            ))}
                            {/* Critical Expirations */}
                            {section1.criticalExpirations.map((e: any, i: number) => (
                                <div key={i} className="bg-white p-4 rounded-lg border border-red-100 shadow-sm flex items-center gap-3">
                                    <ShieldAlert className="w-8 h-8 text-red-500" />
                                    <div>
                                        <p className="font-bold text-gray-900">{e.entityName}</p>
                                        <p className="text-xs text-red-600 font-bold uppercase">{e.alertType} • {e.daysRemaining < 0 ? 'CADUCADO' : `${e.daysRemaining} DÍAS`}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* SECTION 2: OPERATIONS TODAY */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                    <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">Operativa Hoy</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-gray-900">{section2.workingNow}</span>
                            <span className="text-xs font-bold text-gray-400 uppercase mt-1 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Activos Ahora
                            </span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-blue-600">{section2.driversOnRoute}</span>
                            <span className="text-xs font-bold text-blue-200 uppercase mt-1 flex items-center gap-1">
                                <Truck className="w-3 h-3" /> En Ruta
                            </span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-black text-gray-900">{section2.activeTrucks}</span>
                            <span className="text-xs font-bold text-gray-400 uppercase mt-1 flex items-center gap-1">
                                <Activity className="w-3 h-3" /> Flota Disp.
                            </span>
                        </CardContent>
                    </Card>
                    <Card className={`${section2.incidentsToday > 0 ? 'border-red-200 bg-red-50' : ''}`}>
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className={`text-3xl font-black ${section2.incidentsToday > 0 ? 'text-red-600' : 'text-gray-900'}`}>{section2.incidentsToday}</span>
                            <span className={`text-xs font-bold uppercase mt-1 flex items-center gap-1 ${section2.incidentsToday > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                <AlertTriangle className="w-3 h-3" /> Incidencias Hoy
                            </span>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* SECTION 3: MONTHLY PERFORMANCE */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">Rendimiento Mensual</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* KPIs Grid (8 cols) */}
                    <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Horas Totales</p>
                                <p className="text-2xl font-black text-gray-900">{section3.totalMonthlyHours.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Productividad (H/Emp)</p>
                                <p className="text-2xl font-black text-indigo-600">{section3.productivity}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">KM Recorridos</p>
                                <p className="text-2xl font-black text-gray-900">{section3.totalMonthlyKm.toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Coste Estimado</p>
                                <p className="text-2xl font-black text-gray-900 flex items-center gap-1">
                                    {section3.estimatedLaborCost.toLocaleString()} <Euro className="w-4 h-4 text-gray-400" />
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">% Absentismo</p>
                                <p className={`text-2xl font-black ${section3.absenteeismPct > 5 ? 'text-red-500' : 'text-green-600'}`}>
                                    {section3.absenteeismPct}%
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI SUMMARY (4 cols) */}
                    <Card className="lg:col-span-4 bg-gradient-to-br from-indigo-900 to-indigo-800 text-white border-none shadow-lg">
                        <CardContent className="p-6 h-full flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3">
                                <PlayCircle className="w-5 h-5 text-indigo-300" />
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">Resumen Ejecutivo</span>
                            </div>
                            <p className="text-sm leading-relaxed opacity-90">
                                La productividad se mantiene estable en <span className="font-bold text-white">{section3.productivity}h</span> por empleado.
                                {section3.absenteeismPct > 5
                                    ? ' Se detecta un repunte en el absentismo que requiere atención.'
                                    : ' El absentismo está controlado.'}
                                {' '}El coste laboral proyectado asciende a {section3.estimatedLaborCost.toLocaleString()}€.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* SECTION 4 & 5: RISK & QUICK ACCESS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* SECTION 4: RISK & COMPLIANCE */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                        <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">Riesgo y Cumplimiento</h3>
                    </div>
                    <Card className="h-full">
                        <CardContent className="p-0">
                            {section4.riskExpirations.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 text-sm">
                                    No hay riesgos próximos detectados.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                    {section4.riskExpirations.map((r: any, i: number) => (
                                        <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-orange-50 rounded-lg">
                                                    <Clock className="w-4 h-4 text-orange-500" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 text-sm">{r.entityName}</p>
                                                    <p className="text-xs text-gray-500 uppercase">{r.alertType}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                                {r.daysRemaining} Días
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>

                {/* SECTION 5: QUICK ACCESS */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-6 bg-gray-600 rounded-full"></div>
                        <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">Accesos Directos</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <QuickAccessBtn icon={Users} label="Personal" href="/admin/empleados" color="blue" />
                        <QuickAccessBtn icon={Truck} label="Flota" href="/admin/camiones" color="emerald" />
                        <QuickAccessBtn icon={Wrench} label="Taller" href="/admin/tareas" color="red" />
                        <QuickAccessBtn icon={Euro} label="Nóminas" href="/admin/nominas" color="indigo" />
                        <QuickAccessBtn icon={FileText} label="Auditoría" href="/admin/auditoria" color="gray" />
                        <QuickAccessBtn icon={TrendingUp} label="Formación" href="/admin/formacion" color="purple" />
                    </div>
                </section>
            </div>
        </div>
    );
}

function QuickAccessBtn({ icon: Icon, label, href, color }: any) {
    const router = useRouter();
    const colorClasses: any = {
        blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200',
        red: 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200',
        indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200',
        purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200',
        gray: 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200',
    };

    return (
        <button
            onClick={() => router.push(href)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02] active:scale-95 ${colorClasses[color]}`}
        >
            <Icon className="w-5 h-5" />
            <span className="font-bold uppercase tracking-tight text-sm">{label}</span>
        </button>
    );
}
