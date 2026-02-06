'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Truck, AlertCircle, Clock, CheckCircle, ArrowRight, User, LayoutDashboard, Calendar, Users, FileText } from 'lucide-react';
import FleetAlertsWidget from '@/components/admin/FleetAlertsWidget';
import PredictiveMaintenanceWidget from '@/components/admin/PredictiveMaintenanceWidget';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import { format } from 'date-fns';

export default function OficinaTareasPage() {
    const router = useRouter();
    const [tareas, setTareas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasActiveJornada, setHasActiveJornada] = useState(true);
    const [fleetStats, setFleetStats] = useState<any>({ upcomingExpirations: [] });
    const [filtroPrioridad, setFiltroPrioridad] = useState('TODAS');

    useEffect(() => {
        fetchTareas();
        fetchJornada();
        fetchFleetStats();
    }, []);

    const fetchFleetStats = async () => {
        try {
            const res = await fetch('/api/admin/dashboard');
            if (res.ok) setFleetStats(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchJornada = async () => {
        try {
            const res = await fetch(`/api/jornadas?date=${new Date().toISOString()}`);
            if (res.ok) {
                const data = await res.json();
                setHasActiveJornada(!!data && !data.horaSalida);
            }
        } catch (e) { console.error(e); }
    };

    const fetchTareas = async () => {
        try {
            const res = await fetch('/api/tareas');
            if (res.ok) {
                setTareas(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const navItems = [
        { id: 'summary', label: 'Panel Oficina', icon: LayoutDashboard },
        { id: 'jornada', label: 'Mi Control de Días', icon: Clock, badgeCount: !hasActiveJornada ? 1 : 0 },
        { id: 'vacaciones', label: 'Mis Vacaciones', icon: Calendar },
        { id: 'historial-personal', label: 'Mi Historial', icon: FileText },
        { id: 'conductores', label: 'Días Conductores', icon: Users },
        { id: 'camiones', label: 'Gestionar Camiones', icon: Truck },
        { id: 'taller', label: 'Averías / Taller', icon: AlertCircle, badgeCount: tareas.filter(t => t.estado === 'ABIERTA').length }
    ];

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando gestión técnica...</div>;

    const filtradas = tareas.filter(t => (filtroPrioridad === 'TODAS' || t.prioridad === filtroPrioridad));
    const activas = filtradas.filter(t => t.estado !== 'CERRADA');
    const historial = filtradas.filter(t => t.estado === 'CERRADA');

    return (
        <MainDashboardLayout
            title="Gestión Técnica y Taller"
            userName="Oficina"
            roleLabel="Gestión Operativa"
            navItems={navItems}
            activeSection="taller"
            onNavigate={(id) => {
                if (id === 'summary') router.push('/oficina/dashboard');
                else if (id === 'jornada') router.push('/oficina/dashboard');
                else if (id === 'vacaciones') router.push('/oficina/dashboard');
                else if (id === 'historial-personal') router.push('/oficina/jornadas');
                else if (id === 'conductores') router.push('/oficina/jornadas?admin=true');
                else if (id === 'camiones') router.push('/oficina/camiones');
                else if (id === 'taller') router.push('/oficina/tareas');
            }}
            onLogout={handleLogout}
        >
            <div className="space-y-8 pb-20">
                {/* 1. SECCIÓN DE ALERTAS DE FLOTA (NUEVO) */}
                {fleetStats.upcomingExpirations?.length > 0 && (
                    <section className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-red-600 rounded-full"></div>
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Alertas de Mantenimiento Legal</h2>
                        </div>
                        <FleetAlertsWidget alerts={fleetStats.upcomingExpirations} hrefPrefix="/oficina" />
                    </section>
                )}

                <PredictiveMaintenanceWidget />

                {/* 2. HEADER Y FILTROS */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Incidencias y Tareas</h1>
                        <p className="text-sm text-gray-500 mt-1">Control de averías mecánicas y gestión de activos.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {['TODAS', 'URGENTE', 'ALTA', 'MEDIA', 'BAJA'].map(p => (
                            <button
                                key={p}
                                onClick={() => setFiltroPrioridad(p)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${filtroPrioridad === p
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. TAREAS ACTIVAS */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-600" />
                            <h2 className="font-bold text-gray-800">Incidentes Activos ({activas.length})</h2>
                        </div>
                        <Button onClick={() => router.push('/tareas/nueva')} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold uppercase text-xs">
                            + Nueva Incidencia
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {activas.map((t) => (
                            <Card key={t.id} className="hover:shadow-md transition-all border-l-4 cursor-pointer group"
                                style={{ borderLeftColor: t.prioridad === 'URGENTE' ? '#ef4444' : t.prioridad === 'ALTA' ? '#f97316' : '#94a3b8' }}
                                onClick={() => router.push(`/tareas/${t.id}`)}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className={`p-3 rounded-xl ${t.estado === 'EN_CURSO' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                            <Truck className={`w-6 h-6 ${t.estado === 'EN_CURSO' ? 'text-blue-600' : 'text-gray-400'}`} />
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="font-bold text-gray-900 truncate uppercase tracking-tight group-hover:text-blue-600 transition-colors">{t.titulo}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-1.5 py-0.5 rounded italic">#{t.id}</span>
                                                <span className="flex items-center gap-1 text-xs text-slate-500 font-bold"><Truck className="w-3 h-3" /> {t.matricula || 'General'}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.estado === 'EN_CURSO' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {t.estado.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                </CardContent>
                            </Card>
                        ))}
                        {activas.length === 0 && (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                                No hay incidencias activas.
                            </div>
                        )}
                    </div>
                </section>

                {/* 4. HISTORIAL DE REPARACIONES */}
                {historial.length > 0 && (
                    <section className="pt-8 border-t">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <h2 className="font-bold text-gray-800">Historial CERRADO (Últimas 10)</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70 hover:opacity-100 transition-opacity">
                            {historial.slice(0, 10).map((t) => (
                                <div key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="flex items-center justify-between p-4 bg-white border rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3 truncate">
                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span className="text-sm font-medium text-gray-700 truncate">{t.titulo}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400">{format(new Date(t.updatedAt), 'dd/MM')}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </MainDashboardLayout>
    );
}
