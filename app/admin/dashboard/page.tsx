'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import AdminAbsenceWidget from '@/components/admin/AdminAbsenceWidget';
import FleetAlertsWidget from '@/components/admin/FleetAlertsWidget';
import PredictiveMaintenanceWidget from '@/components/admin/PredictiveMaintenanceWidget';
import { Users, Truck, Calendar, AlertCircle, LayoutDashboard, Clock, CheckCircle, TrendingUp, Droplet, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        activeEmployees: 0,
        activeTrucks: 0,
        openIncidents: 0,
        downloadsThisMonth: 0,
        activeClockIns: 0,
        pendingAbsences: 0,
        totalMonthlyHours: 0,
        totalMonthlyKm: 0,
        upcomingExpirations: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/admin/dashboard');
                if (res.ok) {
                    setStats(await res.json());
                }
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const formatHours = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-700">
            {/* Minimalist Premium Header */}
            <header className="relative overflow-hidden bg-blue-900 text-white p-8 rounded-3xl shadow-2xl border border-blue-800">
                <div className="absolute top-0 right-0 -m-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">SISTEMA v2.5</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter">Panel de Gestión Integral</h1>
                        <p className="text-blue-200 text-sm font-medium max-w-md">Supervisión en tiempo real de recursos humanos, logística y mantenimiento preventivo.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-end md:items-center">
                        <div className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-right min-w-[200px]">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300 mb-1">Calendario Laboral</p>
                            <p className="text-lg font-bold">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* SECTION 1: ESTATUS EN TIEMPO REAL */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                    <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Estado Crítico y Operaciones Hoy</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Fichajes Activos', val: stats.activeClockIns, icon: Clock, color: 'blue', desc: 'Personal trabajando ahora' },
                        { label: 'Ausencias Pendientes', val: stats.pendingAbsences, icon: Calendar, color: 'amber', desc: 'Solicitudes por validar' },
                        { label: 'Averías Abiertas', val: stats.openIncidents, icon: AlertCircle, color: 'red', desc: 'Incidentes en taller' },
                        { label: 'Alertas de Flota', val: stats.upcomingExpirations.length, icon: Truck, color: 'indigo', desc: 'Próximas caducidades' },
                    ].map((s, i) => (
                        <Card key={i} className="border-none shadow-sm hover:shadow-lg transition-all duration-300 group overflow-hidden">
                            <CardContent className="p-0">
                                <div className={`h-1.5 w-full bg-${s.color}-500/20 group-hover:bg-${s.color}-600 transition-colors`}></div>
                                <div className="p-5 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                        <p className={`text-3xl font-black text-${s.color}-600`}>{loading ? '...' : s.val}</p>
                                        <p className="text-[10px] text-gray-400 font-medium">{s.desc}</p>
                                    </div>
                                    <div className={`p-3 rounded-2xl bg-${s.color}-50 text-${s.color}-600`}>
                                        <s.icon className="w-6 h-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-8">
                    {/* SECTION 2: ACTIVIDAD MENSUAL ACUMULADA */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Resumen de Actividad Mensual</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { label: 'Horas Trabajadas', val: formatHours(stats.totalMonthlyHours), icon: CheckCircle, color: 'slate' },
                                { label: 'KM Recorridos', val: `${stats.totalMonthlyKm} km`, icon: TrendingUp, color: 'slate' },
                                { label: 'Entregas/Cargas', val: stats.downloadsThisMonth, icon: Droplet, color: 'slate' },
                            ].map((s, i) => (
                                <Card key={i} className="border-none shadow-sm bg-gray-50/50">
                                    <CardContent className="p-5">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white rounded-xl shadow-sm">
                                                <s.icon className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                                                <p className="text-xl font-black text-gray-900">{loading ? '...' : s.val}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* SECTION 3: ACCESOS DIRECTOS */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">Navegación y Gestión</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { href: '/admin/empleados', label: 'Personal', sub: 'Usuarios y roles', icon: Users, color: 'blue' },
                                { href: '/admin/camiones', label: 'Flota', sub: 'Estado de camiones', icon: Truck, color: 'indigo' },
                                { href: '/admin/tareas', label: 'Taller', sub: 'Gestión averías', icon: AlertCircle, color: 'red' },
                                { href: '/admin/jornadas', label: 'Auditoría', sub: 'Control de días', icon: FileText, color: 'emerald' },
                                { href: '/admin/fiestas', label: 'Festivos', sub: 'Calendario anual', icon: Calendar, color: 'amber' },
                                { href: '/admin/nominas', label: 'Nóminas', sub: 'Cierre mensual', icon: TrendingUp, color: 'purple' },
                                { href: '/admin/formacion', label: 'Formación', sub: 'Cursos internos', icon: BookOpen, color: 'indigo' },
                            ].map((link, idx) => (
                                <Link key={idx} href={link.href}>
                                    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                                        <div className={`p-3 rounded-xl bg-${link.color}-50 text-${link.color}-600 group-hover:bg-${link.color}-600 group-hover:text-white transition-colors`}>
                                            <link.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{link.label}</p>
                                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{link.sub}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                </div>

                {/* SIDEBAR WIDGETS */}
                <aside className="space-y-8 h-full">
                    {/* IA WIDGET AREA */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest italic">Inteligencia Fleet</h2>
                        </div>
                        <PredictiveMaintenanceWidget />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-1 text-red-600">
                            <AlertCircle className="w-5 h-5" />
                            <h2 className="text-sm font-black uppercase tracking-widest">Alertas Técnicas</h2>
                        </div>
                        <FleetAlertsWidget alerts={stats.upcomingExpirations} />
                    </div>

                    <div className="space-y-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h2 className="text-sm font-black text-blue-900 uppercase tracking-widest">Control Ausencias</h2>
                        </div>
                        <AdminAbsenceWidget />
                    </div>
                </aside>
            </div>

            <footer className="pt-10 border-t border-gray-100 flex flex-col items-center gap-4">
                <Link href="/admin/dashboard" className="text-xs font-black text-blue-600/50 hover:text-blue-600 flex items-center gap-2 transition-colors uppercase tracking-[0.3em]">
                    <LayoutDashboard className="w-4 h-4" /> REFRESCAR SISTEMA
                </Link>
                <div className="text-center text-[10px] text-gray-300 font-black uppercase tracking-[0.5em]">
                    SISTEMA DE GESTIÓN SEL • 2026
                </div>
            </footer>
        </div>
    );
}
