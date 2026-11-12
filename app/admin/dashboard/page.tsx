'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    CheckCircle,
    X,
    Truck,
    Users,
    Clock,
    TrendingUp,
    Euro,
    Activity,
    Calendar,
    FileText,
    Wrench,
    ChevronRight,
    PlayCircle,
    Briefcase,
    Sparkles,
    Check
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdminDashboard() {
    const router = useRouter();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hiddenAlerts, setHiddenAlerts] = useState<string[]>([]);
    const [processingAbsenceId, setProcessingAbsenceId] = useState<number | null>(null);

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

    useEffect(() => {
        const stored = localStorage.getItem('sel_hidden_alerts');
        if (stored) {
            try {
                setHiddenAlerts(JSON.parse(stored));
            } catch {}
        }
        fetchData();
    }, []);

    const handleQuickAbsenceAction = async (ausenciaId: number, estado: 'APROBADA' | 'RECHAZADA') => {
        setProcessingAbsenceId(ausenciaId);
        try {
            const res = await fetch('/api/ausencias', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: ausenciaId, estado })
            });
            if (res.ok) {
                toast.success(estado === 'APROBADA' ? 'Ausencia aprobada' : 'Ausencia rechazada');
                fetchData();
            } else {
                toast.error('No se pudo actualizar la ausencia');
            }
        } catch {
            toast.error('Error de red');
        } finally {
            setProcessingAbsenceId(null);
        }
    };

    if (loading) return <div className="p-12 text-center text-gray-500 animate-pulse">Cargando cuadro de mando de Hoy...</div>;
    if (!data) return <div className="p-12 text-center text-red-500">Error cargando datos.</div>;

    const { section1, section2, section3, section4 } = data;
    const openShifts = section1.openShifts || [];
    const urgentAbsences = section1.urgentAbsences || [];
    const criticalTasks = section1.criticalTasks || [];
    const expirations = (section1.criticalAlerts || []).filter((a: any) => a.type === 'VENCIMIENTO');

    const hideAlert = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        const newHidden = [...hiddenAlerts, key];
        setHiddenAlerts(newHidden);
        localStorage.setItem('sel_hidden_alerts', JSON.stringify(newHidden));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            {/* TOP HEADER: LO QUE HAY QUE HACER HOY */}
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2 h-7 bg-blue-600 rounded-full" />
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                Hoy: Bandeja de Acción Inmediata
                            </h1>
                            <p className="text-xs text-slate-500">
                                Resuelve ausencias pendientes, jornadas abiertas, averías críticas y vencimientos desde un único lugar.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/admin/informes/centro')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
                    >
                        <Sparkles className="w-4 h-4" /> Abrir Centro de Informes (9 KPIs)
                    </button>
                </div>

                {/* 4 ACTIONABLE COLUMNS FOR TODAY */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {/* 1. AUSENCIAS PENDIENTES DE APROBAR */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-amber-900 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-amber-600" /> Ausencias por Aprobar
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white">
                                {urgentAbsences.length}
                            </span>
                        </div>
                        <div className="p-3 flex-1 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                            {urgentAbsences.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                    Al día. Sin solicitudes pendientes.
                                </div>
                            ) : (
                                urgentAbsences.map((a: any) => (
                                    <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">
                                                {a.empleado?.nombre} {a.empleado?.apellidos}
                                            </p>
                                            <p className="text-[11px] text-amber-700 font-semibold">
                                                {a.tipo} • {format(new Date(a.fechaInicio), 'dd/MM')} a{' '}
                                                {format(new Date(a.fechaFin), 'dd/MM')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                disabled={processingAbsenceId === a.id}
                                                onClick={() => handleQuickAbsenceAction(a.id, 'APROBADA')}
                                                title="Aprobar en 1 clic"
                                                className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-600 text-emerald-700 hover:text-white transition-colors"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                disabled={processingAbsenceId === a.id}
                                                onClick={() => handleQuickAbsenceAction(a.id, 'RECHAZADA')}
                                                title="Rechazar"
                                                className="p-1.5 rounded-lg bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => router.push('/admin/ausencias')}
                            className="px-4 py-2 text-[11px] font-bold text-amber-700 hover:bg-amber-50/60 border-t border-slate-100 text-center"
                        >
                            Ver todas las ausencias →
                        </button>
                    </div>

                    {/* 2. JORNADAS EN CURSO / ABIERTAS */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-blue-900 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-blue-600" /> En Ruta / Trabajando
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white">
                                {openShifts.length}
                            </span>
                        </div>
                        <div className="p-3 flex-1 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                            {openShifts.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    Ningún turno abierto en este momento.
                                </div>
                            ) : (
                                openShifts.map((s: any) => {
                                    const hoursElapsed =
                                        Math.round(
                                            ((Date.now() - new Date(s.horaEntrada).getTime()) / (1000 * 60 * 60)) * 10
                                        ) / 10;
                                    const isLong = hoursElapsed > 10;
                                    const activeMat = s.usosCamion?.[0]?.camion?.matricula;
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => router.push(`/admin/empleados/${s.empleado?.id}`)}
                                            className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 px-1 rounded"
                                        >
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">
                                                    {s.empleado?.nombre} {s.empleado?.apellidos}
                                                </p>
                                                <p className="text-[11px] text-slate-500 font-mono">
                                                    Entrada: {format(new Date(s.horaEntrada), 'HH:mm')}{' '}
                                                    {activeMat ? `• 🚛 ${activeMat}` : ''}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    isLong
                                                        ? 'bg-rose-100 text-rose-700 animate-pulse'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}
                                            >
                                                {hoursElapsed}h
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <button
                            onClick={() => router.push('/admin/jornadas')}
                            className="px-4 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-50/60 border-t border-slate-100 text-center"
                        >
                            Gestionar fichajes y rutas →
                        </button>
                    </div>

                    {/* 3. AVERÍAS Y TAREAS CRÍTICAS */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-rose-900 flex items-center gap-1.5">
                                <Wrench className="w-4 h-4 text-rose-600" /> Averías / Taller Urgente
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white">
                                {criticalTasks.length}
                            </span>
                        </div>
                        <div className="p-3 flex-1 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                            {criticalTasks.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                    Sin averías urgentes abiertas.
                                </div>
                            ) : (
                                criticalTasks.map((t: any) => (
                                    <div
                                        key={t.id}
                                        onClick={() => router.push(`/admin/tareas?q=${encodeURIComponent(t.titulo)}`)}
                                        className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 px-1 rounded"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">{t.titulo}</p>
                                            <p className="text-[11px] text-slate-500 font-mono">
                                                {t.matricula || 'General'}
                                            </p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold shrink-0">
                                            {t.estado}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => router.push('/admin/tareas')}
                            className="px-4 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50/60 border-t border-slate-100 text-center"
                        >
                            Ir a Taller e Incidencias →
                        </button>
                    </div>

                    {/* 4. VENCIMIENTOS PRÓXIMOS (ITV, SEGURO, ADR, CARNET) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
                        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-purple-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-purple-600" /> Vencimientos Próximos
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-600 text-white">
                                {expirations.length}
                            </span>
                        </div>
                        <div className="p-3 flex-1 divide-y divide-slate-100 max-h-72 overflow-y-auto">
                            {expirations.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">
                                    <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                                    Toda la documentación en regla.
                                </div>
                            ) : (
                                expirations.slice(0, 8).map((al: any, i: number) => (
                                    <div
                                        key={i}
                                        onClick={() =>
                                            router.push(
                                                al.entityType === 'TRUCK'
                                                    ? `/admin/camiones/${al.id}`
                                                    : `/admin/empleados/${al.id}`
                                            )
                                        }
                                        className="py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 px-1 rounded"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 truncate">{al.entity}</p>
                                            <p className="text-[11px] text-rose-600 font-bold">{al.message}</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                            {al.alertType}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => router.push('/admin/informes/centro?report=vencimientos')}
                            className="px-4 py-2 text-[11px] font-bold text-purple-700 hover:bg-purple-50/60 border-t border-slate-100 text-center"
                        >
                            Ver informe de vencimientos 30/60/90d →
                        </button>
                    </div>
                </div>
            </section>

            {/* SECTION 2: OPERACIÓN HOY */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Resumen en Tiempo Real</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        value={section2.workingNow}
                        label="Fichajes Activos"
                        icon={Users}
                        color="blue"
                        href="/admin/jornadas?estado=TRABAJANDO"
                    />
                    <StatCard
                        value={section2.activeTrucks}
                        label="Camiones en Ruta"
                        icon={Truck}
                        color="indigo"
                        href="/admin/camiones"
                    />
                    <StatCard
                        value={section2.incidentsToday}
                        label="Incidencias Hoy"
                        icon={AlertTriangle}
                        color={section2.incidentsToday > 0 ? 'red' : 'gray'}
                        href="/admin/tareas"
                    />
                    <StatCard
                        value={section2.absentToday}
                        label="Personal Ausente Hoy"
                        icon={Briefcase}
                        color="orange"
                        href="/admin/ausencias"
                    />
                </div>
            </section>

            {/* SECTION 3: RENDIMIENTO MENSUAL */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Rendimiento del Mes</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <KpiCard
                            label="Horas Totales"
                            value={section3.totalMonthlyHours.toLocaleString()}
                            sub="H"
                            href="/admin/jornadas"
                        />
                        <KpiCard
                            label="Productividad"
                            value={section3.productivity}
                            sub="H/Emp"
                            highlight
                            href="/admin/informes/mensuales"
                        />
                        <KpiCard
                            label="KM Recorridos"
                            value={section3.totalMonthlyKm.toLocaleString()}
                            sub="KM"
                            href="/admin/camiones"
                        />
                        <KpiCard
                            label="Coste Estimado"
                            value={section3.estimatedLaborCost.toLocaleString()}
                            sub="€"
                            href="/admin/nominas"
                        />
                    </div>

                    <div className="lg:col-span-4">
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-xl shadow-lg h-full flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="w-24 h-24" />
                            </div>
                            <div className="flex items-center gap-2 mb-3 relative z-10">
                                <PlayCircle className="w-5 h-5 text-indigo-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                                    Pulso Operativo
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed opacity-90 relative z-10">
                                La flota ha recorrido{' '}
                                <span className="font-bold text-white">{section3.totalMonthlyKm.toLocaleString()} km</span>{' '}
                                este mes. La productividad media es de{' '}
                                <span className="font-bold text-white">{section3.productivity}h</span>. El absentismo se
                                sitúa en un{' '}
                                <span
                                    className={`font-bold ${
                                        section3.absenteeismPct > 5 ? 'text-red-400' : 'text-emerald-400'
                                    }`}
                                >
                                    {section3.absenteeismPct}%
                                </span>
                                .
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
                    <ControlBox title="PERSONAS (RRHH)" color="blue" icon={Users}>
                        <ControlItem
                            label="Documentación Próxima a Caducar"
                            count={section4.rrhh.docsExpiring}
                            href="/admin/informes/centro?report=vencimientos"
                        />
                        <ControlItem
                            label="Ausencias Pendientes"
                            count={urgentAbsences.length}
                            href="/admin/ausencias"
                        />
                    </ControlBox>

                    <ControlBox title="FLOTA Y TALLER" color="emerald" icon={Truck}>
                        <ControlItem
                            label="Mantenimientos Programados"
                            count={section4.flota.maintenanceNext}
                            href="/admin/camiones"
                        />
                        <ControlItem
                            label="Vehículos con Vencimiento Próximo"
                            count={section4.flota.docsExpiring}
                            href="/admin/camiones"
                        />
                    </ControlBox>

                    <ControlBox title="ADMINISTRACIÓN Y NÓMINAS" color="slate" icon={FileText}>
                        <ControlItem
                            label="Nóminas en Borrador"
                            count={section4.admin.payrollsPending}
                            href="/admin/nominas"
                        />
                        <ControlItem
                            label="Centro de Informes (9 KPIs)"
                            count={0}
                            href="/admin/informes/centro"
                        />
                    </ControlBox>
                </div>
            </section>
        </div>
    );
}

function StatCard({ value, label, icon: Icon, color, href }: any) {
    const router = useRouter();
    const colorClasses: any = {
        blue: 'text-blue-600 bg-blue-50',
        indigo: 'text-indigo-600 bg-indigo-50',
        red: 'text-red-600 bg-red-50',
        orange: 'text-orange-600 bg-orange-50',
        gray: 'text-gray-600 bg-gray-50'
    };

    return (
        <div
            onClick={() => href && router.push(href)}
            className={`bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex items-center justify-between ${
                href ? 'cursor-pointer hover:shadow-md transition-all active:scale-[0.98]' : ''
            }`}
        >
            <div>
                <p className="text-3xl font-black text-gray-900">{value}</p>
                <p className="text-xs font-bold text-gray-400 uppercase mt-1">{label}</p>
            </div>
            <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.gray}`}>
                <Icon className="w-5 h-5" />
            </div>
        </div>
    );
}

function KpiCard({ label, value, sub, highlight, href }: any) {
    const router = useRouter();
    return (
        <div
            onClick={() => href && router.push(href)}
            className={`bg-white p-5 rounded-xl shadow-xs border border-gray-100 flex flex-col justify-center h-full ${
                href ? 'cursor-pointer hover:shadow-md transition-all active:scale-[0.98]' : ''
            }`}
        >
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
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden h-full">
            <div className={`p-4 border-b border-gray-100 flex items-center gap-2 ${headerColors[color]}`}>
                <Icon className="w-4 h-4" />
                <h4 className="font-black text-xs uppercase tracking-wider">{title}</h4>
            </div>
            <div className="p-2 divide-y divide-gray-50">{children}</div>
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
                <CheckCircle className="w-4 h-4 text-emerald-500" />
            )}
        </div>
    );
}
