'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Truck, Clock, ArrowRight, User, Building2, MapPin, AlertTriangle, AlertCircle, Wrench, CheckCircle } from 'lucide-react';
import { TaskStateBadge, TaskPriorityBadge, TaskTypeBadge } from '@/components/tareas/TaskStatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PredictiveMaintenanceWidget from '@/components/admin/PredictiveMaintenanceWidget';

export default function MecanicoTareasPage() {
    const router = useRouter();
    const [tareas, setTareas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('TODAS');

    const [fleetStats, setFleetStats] = useState<any>({ upcomingExpirations: [] });

    useEffect(() => {
        fetchTareas();
        fetchFleetStats();
    }, []);

    const fetchFleetStats = async () => {
        try {
            const res = await fetch('/api/admin/dashboard');
            if (res.ok) setFleetStats(await res.json());
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

    const filtradas = tareas.filter(t => filtroEstado === 'TODAS' || t.estado === filtroEstado);
    const pendientes = tareas.filter(t => t.estado === 'ABIERTA' || t.estado === 'EN_CURSO').length;
    const urgentesYAbiertas = filtradas.filter(t => t.prioridad === 'URGENTE' || t.estado === 'ABIERTA');
    const resto = filtradas.filter(t => t.prioridad !== 'URGENTE' && t.estado !== 'ABIERTA');

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando gestión de taller...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 space-y-10">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* HEADER */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tighter">Panel de Taller</h1>
                        <p className="text-gray-500 font-medium">
                            <span className="text-orange-600">{pendientes}</span> incidencias activas en curso.
                        </p>
                    </div>

                    <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
                        {['TODAS', 'ABIERTA', 'EN_CURSO', 'CERRADA'].map(e => (
                            <button
                                key={e}
                                onClick={() => setFiltroEstado(e)}
                                className={`px-5 py-2.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${filtroEstado === e
                                    ? 'bg-slate-900 text-white shadow-lg'
                                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                    }`}
                            >
                                {e === 'TODAS' ? 'TODAS' : e.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </header>

                {/* VENCIMIENTOS DE FLOTA (NUEVO PARA MECÁNICO) */}
                {fleetStats.upcomingExpirations?.length > 0 && (
                    <section className="bg-red-50/50 p-6 rounded-3xl border-2 border-dashed border-red-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-600 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-red-900 uppercase tracking-tight">Atención: Vencimientos de Flota</h2>
                                <p className="text-xs text-red-700 font-medium">Avisos preventivos para ITV, Tacógrafo y ADR.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {fleetStats.upcomingExpirations.map((alert: any, i: number) => (
                                <div key={i} className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between transition-all ${alert.isExpired ? 'bg-red-100 border-red-200' : 'bg-white border-gray-100'}`}>
                                    <div>
                                        <p className="text-[10px] font-black text-red-600 uppercase mb-0.5">{alert.type}</p>
                                        <p className="text-lg font-black text-gray-900 tracking-tighter">{alert.matricula}</p>
                                        <p className="text-xs font-bold text-gray-500 uppercase">{format(new Date(alert.date), 'dd MMM yyyy', { locale: es })}</p>
                                    </div>
                                    {alert.isExpired ? (
                                        <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg animate-pulse uppercase">Vencido</span>
                                    ) : (
                                        <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-1 rounded-lg uppercase">Próximo</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <PredictiveMaintenanceWidget />

                {/* TASK LIST */}
                <div className="grid grid-cols-1 gap-4">
                    {filtradas.length > 0 ? (
                        <>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="h-4 w-1 bg-orange-500 rounded-full"></div>
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Listado de Averías</h3>
                            </div>
                            {filtradas.map((t) => (
                                <Card
                                    key={t.id}
                                    onClick={() => router.push(`/tareas/${t.id}`)}
                                    className={`group transition-all cursor-pointer border-l-8 shadow-sm hover:shadow-xl hover:-translate-y-1 rounded-2xl overflow-hidden`}
                                    style={{
                                        borderLeftColor: t.prioridad === 'URGENTE' ? '#dc2626' : t.prioridad === 'ALTA' ? '#f97316' : t.prioridad === 'MEDIA' ? '#3b82f6' : '#22c55e'
                                    }}
                                >
                                    <CardContent className="p-0">
                                        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <TaskStateBadge state={t.estado} />
                                                    {t.prioridad === 'URGENTE' && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg animate-pulse uppercase">Urgente</span>}
                                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Ticket #{t.id}</span>
                                                </div>

                                                <h3 className="text-xl font-black text-gray-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors uppercase">
                                                    {t.titulo}
                                                </h3>

                                                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-gray-400 uppercase">
                                                    <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                                                        <Truck className="w-3.5 h-3.5" />
                                                        {t.matricula || 'Mantenimiento General'}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {format(new Date(t.createdAt), "dd LLL", { locale: es })}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <User className="w-3.5 h-3.5" />
                                                        {t.creadoPor?.nombre}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight className="w-6 h-6 text-gray-200 group-hover:text-blue-500 group-hover:translate-x-2 transition-all flex-shrink-0" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2rem] border-2 border-dashed border-gray-100 text-gray-300">
                            <Truck className="w-16 h-16 mb-4 opacity-10" />
                            <p className="font-black uppercase tracking-widest text-sm">No hay incidencias registradas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
