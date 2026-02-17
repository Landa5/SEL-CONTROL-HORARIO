'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Wrench, CheckCircle, Clock, AlertCircle, LogOut, User, LayoutDashboard, Truck, Calendar, ChevronRight, BookOpen } from 'lucide-react';
import EmployeeAbsenceSummary from '@/components/empleado/EmployeeAbsenceSummary';
import EmployeeAbsenceView from '@/components/empleado/EmployeeAbsenceView';
import EmployeeTrainingView from '@/components/empleado/EmployeeTrainingView';
import PredictiveMaintenanceWidget from '@/components/admin/PredictiveMaintenanceWidget';
import FleetAlertsWidget from '@/components/admin/FleetAlertsWidget';

export default function MecanicoDashboard() {
    const router = useRouter();
    const [tareas, setTareas] = useState<any[]>([]);
    const [jornada, setJornada] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [fleetStats, setFleetStats] = useState<any>(null); // State for stats
    const [loading, setLoading] = useState(true);
    const [observaciones, setObservaciones] = useState('');

    // View Control
    const [activeSection, setActiveSection] = useState<'summary' | 'jornada' | 'taller' | 'vacaciones' | 'formacion'>('summary');

    useEffect(() => {
        const loadSession = async () => {
            const res = await fetch('/api/auth/session');
            if (res.ok) setSession(await res.json());
        };
        loadSession();
        fetchTareas();
        fetchJornada();
        fetchFleetStats(); // Fetch stats

        // Check for section in URL
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section');
        if (section) setActiveSection(section as any);
    }, []);

    const fetchFleetStats = async () => {
        try {
            const res = await fetch('/api/admin/dashboard');
            if (res.ok) setFleetStats(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const fetchJornada = async () => {
        try {
            const res = await fetch(`/api/jornadas?date=${new Date().toISOString()}`);
            if (res.ok) setJornada(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchTareas = async () => {
        try {
            const res = await fetch('/api/tareas?tipo=TALLER');
            if (res.ok) {
                const data = await res.json();
                setTareas(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
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

    if (loading) return <div className="p-4 text-center">Cargando panel...</div>;

    const pendientes = tareas.filter(t => t.estado === 'PENDIENTE' || t.estado === 'BACKLOG' || t.estado === 'EN_CURSO');

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        Panel Técnico
                    </h1>
                    <p className="text-gray-500 text-sm">Gestión de Taller y Mantenimiento</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                        <p className="text-xs font-bold text-gray-400 uppercase">Fecha</p>
                        <p className="text-sm font-semibold text-gray-700 capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                        <LogOut className="w-4 h-4" /> Salir
                    </Button>
                </div>
            </header>

            {activeSection === 'summary' ? (
                <div className="space-y-6 animate-in fade-in">

                    {/* ALERTS SECTION (NEW) */}
                    <div className="grid grid-cols-1 gap-6">
                        <FleetAlertsWidget
                            alerts={fleetStats?.section1?.criticalAlerts || []}
                            hrefPrefix="/mecanico"
                        />
                    </div>

                    {/* Summary Widgets */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <EmployeeAbsenceSummary />

                        {/* Quick Status Card */}
                        <Card className="border-l-4 border-l-orange-500 shadow-sm">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase">Averías Pendientes</p>
                                    <p className="text-3xl font-black text-gray-900">{pendientes.length}</p>
                                    <Button variant="ghost" onClick={() => setActiveSection('taller')} className="p-0 h-auto text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 py-1 mt-2">
                                        Gestionar Taller →
                                    </Button>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-full text-orange-600">
                                    <Wrench className="w-8 h-8" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <PredictiveMaintenanceWidget />

                    {/* Navigation Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Mi Jornada */}
                        <Card
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-600"
                            onClick={() => setActiveSection('jornada')}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-50 rounded-xl">
                                            <Clock className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Mi Jornada</p>
                                            {!jornada ? (
                                                <p className="text-lg font-bold text-gray-900">Sin iniciar</p>
                                            ) : jornada.horaSalida ? (
                                                <p className="text-lg font-bold text-green-600">Completada</p>
                                            ) : (
                                                <p className="text-lg font-bold text-blue-600">En curso</p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Taller / Tasks */}
                        <Card
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-600"
                            onClick={() => setActiveSection('taller')}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-red-50 rounded-xl">
                                            <AlertCircle className="w-6 h-6 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Taller</p>
                                            <p className="text-lg font-bold text-gray-900">Ver Incidencias</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Vacaciones */}
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
                                            <p className="text-lg font-bold text-gray-900">Gestionar</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Formación */}
                        <Card
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-600"
                            onClick={() => setActiveSection('formacion')}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-purple-50 rounded-xl">
                                            <BookOpen className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase">Cursos</p>
                                            <p className="text-lg font-bold text-gray-900">Mi Formación</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <Button
                            variant="outline"
                            className="w-full md:w-auto h-auto py-4 flex flex-col gap-2 hover:border-indigo-500 hover:bg-indigo-50 group"
                            onClick={() => router.push('/mecanico/camiones')}
                        >
                            <Truck className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-gray-700">Fichas Técnicas / Flota</span>
                        </Button>
                    </div>

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
                                    <Clock className="w-6 h-6" /> Control de Mi Jornada
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                {!jornada ? (
                                    <div className="text-center space-y-6">
                                        <div className="bg-gray-50 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
                                            <Clock className="w-12 h-12 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-lg">No has iniciado jornada hoy.</p>
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
                                        <p className="text-green-700 font-bold text-2xl">Jornada Finalizada</p>
                                        <p className="text-gray-500">Has trabajado de {format(new Date(jornada.horaEntrada), 'HH:mm')} a {format(new Date(jornada.horaSalida), 'HH:mm')}</p>
                                        <Button
                                            onClick={() => setJornada(null)}
                                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full font-bold"
                                        >
                                            Iniciar Nueva Jornada
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
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border">
                                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <Wrench className="w-6 h-6 text-orange-600" /> Incidencias del Taller
                                </h2>
                                <Button onClick={() => router.push('/mecanico/tareas')} variant="outline">
                                    Ver todas
                                </Button>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {pendientes.length === 0 ? (
                                    <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed">
                                        <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-2" />
                                        <p className="text-gray-400">Todo limpio. No hay averías pendientes.</p>
                                    </div>
                                ) : (
                                    pendientes.map(tarea => (
                                        <Card key={tarea.id} className="hover:shadow-md cursor-pointer transition-all border-l-4 border-l-orange-500" onClick={() => router.push(`/tareas/${tarea.id}`)}>
                                            <CardContent className="p-5 space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">Orden #{tarea.id}</span>
                                                    <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{tarea.prioridad}</span>
                                                </div>
                                                <h3 className="font-bold text-gray-800 line-clamp-1">{tarea.titulo}</h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <Truck className="w-4 h-4" />
                                                    {tarea.matricula || 'General'}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeSection === 'formacion' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <EmployeeTrainingView />
                        </div>
                    )}
                </div>
            )}
        </div >
    );
}
