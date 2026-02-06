'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Truck, Clock, ArrowRight, User, Building2, Plus, AlertCircle } from 'lucide-react';
import { TaskStateBadge, TaskTypeBadge } from '@/components/tareas/TaskStatusBadge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminTareasPage() {
    const router = useRouter();
    const [tareas, setTareas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('TODAS');

    useEffect(() => {
        fetchTareas();
    }, []);

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

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando gestión de tareas...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 space-y-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* HEADER */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-blue-900 uppercase tracking-tight">Centro de Tareas</h1>
                        <p className="text-gray-500">
                            Gestión global de incidencias. <span className="font-bold text-orange-600">{pendientes} activas</span>.
                        </p>
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 hidden md:flex">
                            {['TODAS', 'ABIERTA', 'EN_CURSO', 'CERRADA'].map(e => (
                                <button
                                    key={e}
                                    onClick={() => setFiltroEstado(e)}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filtroEstado === e
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                        }`}
                                >
                                    {e === 'TODAS' ? 'TODAS' : e.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        <Button
                            onClick={() => router.push('/admin/tareas/nueva')}
                            className="bg-blue-900 hover:bg-blue-800 shadow-blue-200 shadow-lg text-white font-bold"
                        >
                            <Plus className="w-5 h-5 mr-2" /> NUEVA TAREA
                        </Button>
                    </div>
                </header>

                {/* MOBILE FILTERS */}
                <div className="flex md:hidden bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                    {['TODAS', 'ABIERTA', 'EN_CURSO', 'CERRADA'].map(e => (
                        <button
                            key={e}
                            onClick={() => setFiltroEstado(e)}
                            className={`flex-shrink-0 px-4 py-2 text-xs font-bold rounded-lg transition-all ${filtroEstado === e
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                }`}
                        >
                            {e === 'TODAS' ? 'TODAS' : e.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* TASK LIST */}
                <div className="grid grid-cols-1 gap-4">
                    {filtradas.map((t) => (
                        <Card
                            key={t.id}
                            onClick={() => router.push(`/tareas/${t.id}`)}
                            className="scale-100 hover:scale-[1.01] transition-transform cursor-pointer border-l-[6px] shadow-sm hover:shadow-md"
                            style={{
                                borderLeftColor: t.prioridad === 'URGENTE' ? '#dc2626' : t.prioridad === 'ALTA' ? '#f97316' : t.prioridad === 'MEDIA' ? '#3b82f6' : '#22c55e'
                            }}
                        >
                            <CardContent className="p-0">
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">

                                    {/* INFO PRINCIPAL */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TaskTypeBadge type={t.tipo} />
                                            <TaskStateBadge state={t.estado} />
                                            {t.prioridad === 'URGENTE' && <span className="text-xs font-bold text-red-600 animate-pulse">URGENTE</span>}
                                            <span className="text-xs text-gray-400">#{t.id}</span>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-800 leading-tight">
                                            {t.titulo}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                                            {t.activoTipo === 'CAMION' && (
                                                <div className="flex items-center gap-1.5 text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                    <Truck className="w-3.5 h-3.5" />
                                                    {t.matricula}
                                                </div>
                                            )}
                                            {t.activoTipo === 'DEPOSITO_CLIENTE' && (
                                                <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    {t.clienteNombre}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {format(new Date(t.createdAt), "d MMM", { locale: es })}
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5" />
                                                {t.creadoPor?.nombre}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ACTIONS */}
                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" size="sm" className="hidden md:flex text-gray-400 hover:text-blue-600">
                                            Ver detalle <ArrowRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {filtradas.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-bold">No hay tareas en esta vista</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
