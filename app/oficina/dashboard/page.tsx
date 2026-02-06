'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
    Clock,
    Calendar,
    AlertCircle,
    LayoutDashboard,
    LogOut,
    ChevronRight,
    CheckCircle,
    Truck,
    Users,
    FileText,
    BookOpen
} from 'lucide-react';
import EmployeeAbsenceSummary from '@/components/empleado/EmployeeAbsenceSummary';
import EmployeeWorkdaySummary from '@/components/empleado/EmployeeWorkdaySummary';
import EmployeeAbsenceView from '@/components/empleado/EmployeeAbsenceView';
import MainDashboardLayout from '@/components/layout/MainDashboardLayout';
import FleetAlertsWidget from '@/components/admin/FleetAlertsWidget';
import PredictiveMaintenanceWidget from '@/components/admin/PredictiveMaintenanceWidget';


export default function OficinaDashboard() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [jornada, setJornada] = useState<any>(null);
    const [tareas, setTareas] = useState<any[]>([]);
    const [fleetStats, setFleetStats] = useState<any>({ upcomingExpirations: [] });
    const [loading, setLoading] = useState(true);


    // View control
    const [activeSection, setActiveSection] = useState<'summary' | 'jornada' | 'vacaciones' | 'taller'>('summary');
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        const loadSession = async () => {
            const res = await fetch('/api/auth/session');
            if (res.ok) setSession(await res.json());
        };
        loadSession();
        fetchJornada();
        fetchTareas();
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
                setJornada(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTareas = async () => {
        try {
            const res = await fetch('/api/tareas?estado=ABIERTA');
            if (res.ok) {
                setTareas(await res.json());
            }
        } catch (e) { console.error(e); }
    };

    const handleClockIn = async () => {
        try {
            const res = await fetch('/api/jornadas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha: new Date(),
                    horaEntrada: new Date(),
                    estado: 'TRABAJANDO'
                })
            });
            if (res.ok) {
                await fetchJornada();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleClockOut = async () => {
        if (!jornada) return;
        try {
            const res = await fetch('/api/jornadas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: jornada.id,
                    horaSalida: new Date(),
                    observaciones
                })
            });
            if (res.ok) {
                setObservaciones('');
                await fetchJornada();
                setActiveSection('summary');
            }
        } catch (error) {
            alert('Error de conexión');
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const formatHours = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando panel...</div>;

    const navItems = [
        { id: 'summary', label: 'Panel Oficina', icon: LayoutDashboard },
        { id: 'jornada', label: 'Mi Control de Días', icon: Clock, badgeCount: !jornada ? 1 : 0 },
        { id: 'vacaciones', label: 'Mis Vacaciones', icon: Calendar },
        { id: 'historial-personal', label: 'Mi Historial', icon: FileText },
        { id: 'conductores', label: 'Días Conductores', icon: Users },
        { id: 'camiones', label: 'Gestionar Camiones', icon: Truck },
        { id: 'taller', label: 'Averías / Taller', icon: AlertCircle, badgeCount: tareas.filter(t => t.estado === 'ABIERTA').length },
        { id: 'formacion', label: 'Formación', icon: BookOpen }
    ];

    return (
        <MainDashboardLayout
            title="Panel de Oficina"
            userName={session?.nombre || 'Administración'}
            roleLabel="Gestión Logística"
            navItems={navItems}
            activeSection={activeSection}
            onNavigate={(id) => {
                if (id === 'conductores') {
                    router.push('/oficina/jornadas?admin=true');
                    return;
                }
                if (id === 'historial-personal') {
                    router.push('/oficina/jornadas');
                    return;
                }
                if (id === 'camiones') {
                    router.push('/oficina/camiones');
                    return;
                }
                if (id === 'taller') {
                    router.push('/oficina/tareas');
                    return;
                }
                if (id === 'formacion') {
                    router.push('/admin/formacion');
                    return;
                }
                setActiveSection(id as any);
            }}
            onLogout={handleLogout}
        >
            {activeSection === 'summary' ? (
                <div className="space-y-8 animate-in fade-in fill-mode-both duration-500">

                    {/* TOP SECTION: URGENT ALERTS OR CURRENT STATUS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <FleetAlertsWidget
                                alerts={fleetStats.upcomingExpirations}
                                hrefPrefix="/oficina"
                            />
                            <div className="mt-6">
                                <PredictiveMaintenanceWidget />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Card className={`border-l-4 shadow-sm ${!jornada ? 'border-l-gray-300' : jornada.horaSalida ? 'border-l-green-500' : 'border-l-blue-500 animate-pulse'}`}>
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-gray-50 rounded-lg">
                                                <Clock className="w-5 h-5 text-gray-500" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Mi Estado Hoy</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setActiveSection('jornada')} className="h-7 text-[10px] font-bold uppercase tracking-tighter hover:bg-gray-100">Configurar →</Button>
                                    </div>
                                    {!jornada ? (
                                        <div className="space-y-4">
                                            <p className="text-sm font-medium text-gray-500">No has iniciado tu jornada todavía.</p>
                                            <Button onClick={handleClockIn} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 font-bold shadow-lg shadow-blue-100">FICHAR ENTRADA</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-2xl font-black text-gray-900">{format(new Date(jornada.horaEntrada), 'HH:mm')}</p>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Mi Entrada</p>
                                            </div>
                                            {jornada.horaSalida ? (
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-green-600">{format(new Date(jornada.horaSalida), 'HH:mm')}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Mi Salida</p>
                                                </div>
                                            ) : (
                                                <Button onClick={() => setActiveSection('jornada')} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 font-bold">FICHAR SALIDA</Button>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    {/* MANAGEMENT SECTION */}
                    <section>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Gestión Operativa y Flota</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Link href="/oficina/camiones" className="block h-full">
                                <Card className="hover:shadow-md transition-all border-b-2 border-b-emerald-500 group h-full">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-emerald-50 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                                <Truck className="w-6 h-6 text-emerald-600 group-hover:text-white" />
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Gestión de Flota</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase mt-1">Camiones, ITV y Documentación</p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Link href="/oficina/jornadas?admin=true" className="block h-full">
                                <Card className="hover:shadow-md transition-all border-b-2 border-b-blue-600 group h-full">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <Users className="w-6 h-6 text-blue-600 group-hover:text-white" />
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Días de Conductores</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase mt-1">Supervisión de horarios y rutas</p>
                                    </CardContent>
                                </Card>
                            </Link>

                            <Card
                                className="cursor-pointer hover:shadow-md transition-all border-b-2 border-b-red-600 group"
                                onClick={() => setActiveSection('taller')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-red-50 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors">
                                            <AlertCircle className="w-6 h-6 text-red-600 group-hover:text-white" />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-red-600 transition-colors" />
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Control de Averías</h3>
                                    <p className="text-xs text-gray-400 font-bold uppercase mt-1">{tareas.length} Tareas abiertas en taller</p>
                                </CardContent>
                            </Card>

                            <Link href="/admin/formacion" className="block h-full">
                                <Card className="hover:shadow-md transition-all border-b-2 border-b-indigo-700 group h-full">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-indigo-50 rounded-xl group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                                                <BookOpen className="w-6 h-6 text-indigo-700 group-hover:text-white" />
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-700 transition-colors" />
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Formación Interna</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase mt-1">Cursos y capacitaciones</p>
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    </section>

                    {/* PERSONAL SECTION */}
                    <section className="bg-gray-50/50 -mx-6 p-6 border-y border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-6 w-1 bg-gray-400 rounded-full"></div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Mi Actividad Personal</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <EmployeeWorkdaySummary />

                            <Card
                                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-indigo-600"
                                onClick={() => router.push('/oficina/jornadas')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-indigo-50 rounded-xl">
                                                <Calendar className="w-6 h-6 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Mi Historial</p>
                                                <p className="text-lg font-black text-gray-900">Ver mis registros</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card
                                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-emerald-600"
                                onClick={() => setActiveSection('vacaciones')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-emerald-50 rounded-xl">
                                                <Calendar className="w-6 h-6 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Mis Vacaciones</p>
                                                <p className="text-lg font-black text-gray-900">Solicitudes y Días</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                </div>
            ) : (
                <div className="animate-in slide-in-from-right-4 fade-in">
                    <Button variant="outline" onClick={() => setActiveSection('summary')} className="gap-2 mb-4">
                        ← Volver al Panel
                    </Button>

                    {activeSection === 'jornada' && (
                        <Card className="max-w-2xl mx-auto shadow-lg border-blue-100">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-blue-800">
                                    <Clock className="w-6 h-6" /> Registro de Mis Días
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                {!jornada ? (
                                    <div className="text-center space-y-6">
                                        <div className="bg-gray-50 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
                                            <Clock className="w-12 h-12 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-lg">No has registrado tu entrada hoy.</p>
                                        <Button onClick={handleClockIn} size="xl" className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-xl font-bold shadow-blue-200 shadow-lg">
                                            FICHAR ENTRADA
                                        </Button>
                                    </div>
                                ) : !jornada.horaSalida ? (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-6 bg-blue-50 rounded-xl text-center border border-blue-100">
                                                <p className="text-xs text-blue-700 font-bold uppercase mb-1">Entrada</p>
                                                <p className="text-4xl font-mono font-bold text-blue-900">{format(new Date(jornada.horaEntrada), 'HH:mm')}</p>
                                            </div>
                                            <div className="p-6 bg-green-50 rounded-xl text-center border border-green-100">
                                                <p className="text-xs text-green-700 font-bold uppercase mb-1">Estado</p>
                                                <p className="text-2xl font-bold text-green-600 mt-1">TRABAJANDO</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-gray-700">Observaciones de salida (opcional)</label>
                                            <textarea
                                                className="w-full border rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-blue-500"
                                                placeholder="Notas..."
                                                value={observaciones}
                                                onChange={e => setObservaciones(e.target.value)}
                                            />
                                        </div>
                                        <Button onClick={handleClockOut} size="xl" className="w-full bg-red-600 hover:bg-red-700 h-16 text-xl font-bold shadow-red-200 shadow-lg">
                                            FICHAR SALIDA
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center p-12 bg-gray-50 rounded-xl space-y-4">
                                        <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
                                        <p className="text-green-700 font-bold text-2xl">Día Completado</p>
                                        <p className="text-gray-500">Has trabajado de {format(new Date(jornada.horaEntrada), 'HH:mm')} a {format(new Date(jornada.horaSalida), 'HH:mm')}</p>
                                        <Button
                                            onClick={() => setJornada(null)}
                                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full font-bold"
                                        >
                                            Iniciar Nuevo Día
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'vacaciones' && (
                        <Card className="shadow-lg border-emerald-100">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-emerald-800">
                                    <Calendar className="w-6 h-6" /> Gestión de Mis Vacaciones
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <EmployeeAbsenceView />
                            </CardContent>
                        </Card>
                    )}

                    {activeSection === 'taller' && (
                        <Card className="shadow-lg border-red-100">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-red-800">
                                    <AlertCircle className="w-6 h-6" /> Panel de Incidencias / Tareas
                                </CardTitle>
                                <Button onClick={() => router.push('/tareas/nueva')} className="bg-red-600 hover:bg-red-700">
                                    + Nueva Incidencia
                                </Button>
                            </CardHeader>
                            <CardContent className="p-6">
                                {tareas.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        No hay tareas abiertas pendientes.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {tareas.map((t: any) => (
                                            <div key={t.id} onClick={() => router.push(`/tareas/${t.id}`)} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer border hover:border-red-200 transition-all">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-800 uppercase text-sm">#{t.id} {t.titulo}</span>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${t.prioridad === 'ALTA' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>{t.prioridad}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                                        <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {t.camion?.matricula || 'General'}</span>
                                                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {t.asignadoA?.nombre || 'Sin asignar'}</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Button variant="ghost" onClick={() => router.push('/oficina/tareas')} className="w-full mt-4 text-red-600 hover:text-red-700 hover:bg-red-50">
                                    Ver Historial Completo →
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </MainDashboardLayout>
    );
}
