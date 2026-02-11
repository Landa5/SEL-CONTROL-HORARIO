'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Save, Calendar, Clock, User, AlertCircle, CheckCircle, MessageSquare, Paperclip, Activity, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TareaEstado, TareaPrioridad, TareaTipo } from '@prisma/client';
import { toast } from 'sonner';
import TaskCRM from '@/components/tareas/TaskCRM';

interface TareaDetalle {
    id: number;
    titulo: string;
    descripcion: string;
    estado: TareaEstado;
    prioridad: TareaPrioridad;
    tipo: TareaTipo;
    asignadoA: {
        nombre: string;
        apellidos: string;
    } | null;
    creador: {
        nombre: string;
        apellidos: string;
    };
    fechaVencimiento: string | null;
    createdAt: string;
    updatedAt: string;
    proyectoId: number | null;
    motivoBloqueo: string | null;
    subtareas: {
        id: number;
        titulo: string;
        estado: TareaEstado;
    }[];
    historial: any[];
}

export default function AdminTaskDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [task, setTask] = useState<TareaDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Form states for quick updates
    const [status, setStatus] = useState<TareaEstado | ''>('');
    const [priority, setPriority] = useState<TareaPrioridad | ''>('');
    const [blockReason, setBlockReason] = useState('');

    useEffect(() => {
        fetchTask();
    }, [params.id]);

    const fetchTask = async () => {
        try {
            const res = await fetch(`/api/tareas/${params.id}`);
            if (!res.ok) throw new Error('Error al cargar la tarea');
            const data = await res.json();
            setTask(data);
            setStatus(data.estado);
            setPriority(data.prioridad);
            if (data.motivoBloqueo) setBlockReason(data.motivoBloqueo);
        } catch (err) {
            setError('No se pudo cargar la tarea');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        try {
            const res = await fetch(`/api/tareas/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: status,
                    prioridad: priority,
                    motivoBloqueo: status === 'BLOQUEADA' ? blockReason : null
                })
            });

            if (!res.ok) throw new Error('Error al actualizar');

            toast.success('Tarea actualizada correctamente');
            fetchTask();
        } catch (err) {
            toast.error('Error al actualizar la tarea');
            console.error(err);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando tarea...</div>;
    if (error || !task) return <div className="p-8 text-center text-red-500">{error || 'Tarea no encontrada'}</div>;

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                                {task.titulo}
                            </h1>
                            <Badge variant="outline">{task.id}</Badge>
                        </div>
                        <p className="text-gray-500 mt-1">
                            Creada el {format(new Date(task.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20">
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Description Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                            <Activity className="w-5 h-5 mr-2 text-blue-500" />
                            Descripción
                        </h3>
                        <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                            {task.descripcion || "Sin descripción"}
                        </div>
                    </div>

                    {/* Subtasks Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold flex items-center text-gray-800">
                                <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                                Subtareas
                            </h3>
                            <Button variant="outline" size="sm" onClick={() => toast.info('Crear subtarea próximamente')}>
                                <Plus className="w-4 h-4 mr-2" /> Agregar
                            </Button>
                        </div>

                        {task.subtareas && task.subtareas.length > 0 ? (
                            <div className="space-y-2">
                                {task.subtareas.map((sub: any) => (
                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => router.push(`/admin/tareas/${sub.id}`)}>
                                        <div className="flex items-center gap-3">
                                            {sub.estado === 'COMPLETADA' ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                            )}
                                            <span className={sub.estado === 'COMPLETADA' ? 'line-through text-gray-400' : 'text-gray-700'}>
                                                {sub.titulo}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">{sub.estado}</Badge>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">No hay subtareas asociadas.</p>
                        )}
                    </div>

                    {/* Activity/History - CRM Component */}
                    <TaskCRM task={task} onUpdate={fetchTask} />
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status & Priority */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                        <h3 className="text-lg font-semibold text-gray-800">Estado y Prioridad</h3>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as TareaEstado)}
                                className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {Object.values(TareaEstado).map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        {status === 'BLOQUEADA' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-medium text-red-500 uppercase tracking-wider">Motivo de Bloqueo</label>
                                <textarea
                                    value={blockReason}
                                    onChange={(e) => setBlockReason(e.target.value)}
                                    className="flex min-h-[80px] w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="Explica por qué está bloqueada..."
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridad</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as TareaPrioridad)}
                                className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {Object.values(TareaPrioridad).map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Detalles</h3>

                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase">Asignado a</p>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                    {task.asignadoA ? task.asignadoA.nombre[0] : '?'}
                                </div>
                                {task.asignadoA ? `${task.asignadoA.nombre} ${task.asignadoA.apellidos}` : 'Sin asignar'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase">Tipo</p>
                            <Badge variant="secondary" className="font-mono">{task.tipo}</Badge>
                        </div>

                        {task.fechaVencimiento && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-gray-500 uppercase">Vencimiento</p>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                    <Calendar className="w-4 h-4 text-orange-500" />
                                    {format(new Date(task.fechaVencimiento), "d MMM yyyy", { locale: es })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
