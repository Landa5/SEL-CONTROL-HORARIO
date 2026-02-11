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
    PlayCircle,
    Briefcase,
    AlertOctagon
} from 'lucide-react';

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

    if (loading) return <div className="p-12 text-center text-gray-500 animate-pulse">Cargando cuadro de mando...</div>;
    if (!data) return <div className="p-12 text-center text-red-500">Error cargando datos.</div>;

    const { section1, section2, section3, section4 } = data;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">

            {/* SECTION 1: CRITICAL GLOBAL STATUS */}
            <section className="w-full">
                {section1.isStable ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-6 shadow-sm">
                        <div className="bg-white p-4 rounded-full shadow-sm">
                            <CheckCircle className="w-10 h-10 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-emerald-800 uppercase tracking-tight">Sistema Estable</h2>
                            <p className="text-emerald-700 font-medium text-lg">Todo opera con normalidad. No hay alertas críticas pendientes.</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-red-50 border-l-8 border-red-500 rounded-r-xl p-6 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="bg-red-100 p-3 rounded-full animate-pulse">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-red-800 uppercase tracking-tight">Atención Requerida</h2>
                                <p className="text-red-700 font-medium">Se detectaron situaciones que requieren acción inmediata.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {/* Critical Tasks */}
                            {section1.criticalTasks.map((t: any) => (
                                <div key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow-sm cursor-pointer hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded uppercase">Avería / Urgente</span>
                                        <ArrowLink />
                                    </div>
                                    <p className="font-bold text-gray-900 leading-tight">{t.titulo}</p>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <Truck className="w-3 h-3" /> {t.matricula || 'General'}
                                    </p>
                                </div>
                            ))}
                            {/* Urgent Absences */}
                            {section1.urgentAbsences.map((a: any) => (
                                <div key={a.id} onClick={() => router.push('/admin/ausencias')} className="bg-white p-4 rounded-lg border-l-4 border-orange-500 shadow-sm cursor-pointer hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded uppercase">Ausencia Pendiente</span>
                                        <ArrowLink />
                                    </div>
                                    <p className="font-bold text-gray-900 leading-tight">{a.empleado.nombre} {a.empleado.apellidos}</p>
                                    <p className="text-xs text-gray-500 mt-1">Revisar solicitud</p>
                                </div>
                            ))}
                            {/* Critical Alerts (Docs/Exp) */}
                            {section1.criticalAlerts.map((alert: any, i: number) => (
                                <div key={i} className="bg-white p-4 rounded-lg border-l-4 border-red-500 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded uppercase">{alert.type}</span>
                                        </div>
                                        <p className="font-bold text-gray-900">{alert.entity}</p>
                                        <p className="text-xs text-red-600 font-bold uppercase mt-1">{alert.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* SECTION 2: OPERACIÓN HOY */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Operación Hoy</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        value={section2.workingNow}
                        label="Fichajes Activos"
                        icon={Users}
                        color="blue"
                    />
                    <StatCard
                        value={section2.activeTrucks}
                        label="Camiones Activos"
                        icon={Truck}
                        color="indigo"
                    />
                    <StatCard
                        value={section2.incidentsToday}
                        label="Incidencias Hoy"
                        icon={AlertTriangle}
                        color={section2.incidentsToday > 0 ? 'red' : 'gray'}
                    />
                    <StatCard
                        value={section2.absentToday}
                        label="Personal Ausente"
                        icon={Briefcase}
                        color="orange"
                    />
                </div>
            </section>

            {/* SECTION 3: RENDIMIENTO MENSUAL */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Rendimiento Mensual</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* KPIs Grid */}
                    <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard label="Horas Totales" value={section3.totalMonthlyHours.toLocaleString()} sub="H" />
                        <KpiCard label="Productividad" value={section3.productivity} sub="H/Emp" highlight />
                        <KpiCard label="KM Recorridos" value={section3.totalMonthlyKm.toLocaleString()} sub="KM" />
                        <KpiCard label="Coste Estimado" value={section3.estimatedLaborCost.toLocaleString()} sub="€" />
                    </div>

                    {/* AI SUMMARY */}
                    <div className="lg:col-span-4">
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-xl shadow-lg h-full flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-2 mb-3 relative z-10">
                                <PlayCircle className="w-5 h-5 text-indigo-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">Resumen Inteligente</span>
                            </div>
                            <p className="text-sm leading-relaxed opacity-90 relative z-10">
                                La flota ha recorrido <span className="font-bold text-white">{section3.totalMonthlyKm.toLocaleString()} km</span> este mes.
                                La productividad media es de <span className="font-bold text-white">{section3.productivity}h</span>,
                                {section3.productivity > 160 ? ' lo que indica una alta carga de trabajo.' : ' manteniéndose en rangos normales.'}
                                {' '}El absentismo se sitúa en un <span className={`font-bold ${section3.absenteeismPct > 5 ? 'text-red-400' : 'text-emerald-400'}`}>{section3.absenteeismPct}%</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 4: CONTROL Y CUMPLIMIENTO */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Control y Cumplimiento</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* RRHH BOX */}
                    <ControlBox title="RRHH" color="blue" icon={Users}>
                        <ControlItem label="Documentación Pendiente" count={section4.rrhh.docsExpiring} href="/admin/empleados" />
                        <ControlItem label="Formaciones Pendientes" count={section4.rrhh.trainingPending} href="/admin/formacion" />
                    </ControlBox>

                    {/* FLOTA BOX */}
                    <ControlBox title="FLOTA" color="emerald" icon={Truck}>
                        <ControlItem label="Mantenimientos Próximos" count={section4.flota.maintenanceNext} href="/admin/camiones" />
                        <ControlItem label="Documentación Vehículos" count={section4.flota.docsExpiring} href="/admin/camiones" />
                    </ControlBox>

                    {/* ADMIN BOX */}
                    <ControlBox title="ADMINISTRACIÓN" color="slate" icon={FileText}>
                        <ControlItem label="Nóminas en Borrador" count={section4.admin.payrollsPending} href="/admin/nominas" />
                        <ControlItem label="Incidencias Contables" count={section4.admin.accountingIssues} href="/admin/dashboard" />
                    </ControlBox>
                </div>
            </section>

            {/* SECTION 5: ACCESOS RÁPIDOS */}
            <section>
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Accesos Directos</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <QuickAccessBtn icon={Users} label="Personal" href="/admin/empleados" color="blue" />
                    <QuickAccessBtn icon={Truck} label="Flota" href="/admin/camiones" color="emerald" />
                    <QuickAccessBtn icon={Wrench} label="Taller" href="/admin/tareas" color="red" />
                    <QuickAccessBtn icon={Euro} label="Nóminas" href="/admin/nominas" color="indigo" />
                    <QuickAccessBtn icon={FileText} label="Auditoría" href="/admin/auditoria" color="slate" />
                    <QuickAccessBtn icon={TrendingUp} label="Formación" href="/admin/formacion" color="purple" />
                </div>
            </section>
        </div>
    );
}

// --- SUBCOMPONENTS ---

function StatCard({ value, label, icon: Icon, color }: any) {
    const colorClasses: any = {
        blue: 'text-blue-600',
        indigo: 'text-indigo-600',
        red: 'text-red-600',
        orange: 'text-orange-600',
        gray: 'text-gray-600'
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-3xl font-black text-gray-900">{value}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">{label}</p>
            </div>
            <div className={`p-3 rounded-xl bg-${color}-50 ${colorClasses[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}

function KpiCard({ label, value, sub, highlight }: any) {
    return (
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center h-full">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">{label}</p>
            <p className={`text-2xl font-black ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>
                {value} <span className="text-sm text-gray-400 font-normal">{sub}</span>
            </p>
        </div>
    );
}

function ControlBox({ title, color, icon: Icon, children }: any) {
    const headerColors: any = {
        blue: 'bg-blue-50 text-blue-700',
        emerald: 'bg-emerald-50 text-emerald-700',
        slate: 'bg-slate-50 text-slate-700'
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-full">
            <div className={`p-4 border-b border-gray-100 flex items-center gap-2 ${headerColors[color]}`}>
                <Icon className="w-4 h-4" />
                <h4 className="font-black text-xs uppercase tracking-wider">{title}</h4>
            </div>
            <div className="p-2 divide-y divide-gray-50">
                {children}
            </div>
        </div>
    );
}

function ControlItem({ label, count, href }: any) {
    const router = useRouter();
    return (
        <div
            onClick={() => router.push(href)}
            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors group"
        >
            <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900">{label}</span>
            {count > 0 ? (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
            ) : (
                <CheckCircle className="w-4 h-4 text-gray-300" />
            )}
        </div>
    );
}

function QuickAccessBtn({ icon: Icon, label, href, color }: any) {
    const router = useRouter();
    const colorClasses: any = {
        blue: 'hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600',
        emerald: 'hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600',
        red: 'hover:bg-red-50 hover:border-red-200 hover:text-red-600',
        indigo: 'hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600',
        purple: 'hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600',
        slate: 'hover:bg-slate-50 hover:border-slate-200 hover:text-slate-600',
    };

    return (
        <button
            onClick={() => router.push(href)}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-100 bg-white transition-all shadow-sm active:scale-95 group ${colorClasses[color]}`}
        >
            <Icon className="w-6 h-6 text-gray-400 group-hover:text-current transition-colors" />
            <span className="font-bold text-xs uppercase tracking-tight text-gray-600 group-hover:text-current transition-colors">{label}</span>
        </button>
    );
}

function ArrowLink() {
    return <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />;
}
