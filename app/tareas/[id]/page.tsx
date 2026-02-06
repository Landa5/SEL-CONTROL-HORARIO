'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from "@/components/ui/Button";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Truck, MapPin, Building2, AlertTriangle, CheckCircle, XCircle, Clock, Save, User } from 'lucide-react';
import { TaskStateBadge, TaskTypeBadge, TaskPriorityBadge } from '@/components/tareas/TaskStatusBadge';
import TaskCRM from '@/components/tareas/TaskCRM';

export default function DetalleTareaPage() {
    const router = useRouter();
    const params = useParams();
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Actions State
    const [resumenCierre, setResumenCierre] = useState('');
    const [showCloseForm, setShowCloseForm] = useState(false);

    useEffect(() => {
        if (params?.id) {
            fetchTask();
        }
    }, [params?.id]);

    const fetchTask = async () => {
        try {
            const res = await fetch(`/api/tareas/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setTask(data);
            } else {
                setError('No se pudo cargar la tarea');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (estado: string) => {
        if (estado === 'CERRADA' && !resumenCierre && !task.resumenCierre) {
            alert("Es obligatorio rellenar el resumen de cierre.");
            return;
        }

        try {
            const res = await fetch(`/api/tareas/${params.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado,
                    resumenCierre: estado === 'CERRADA' ? resumenCierre : undefined
                })
            });

            if (res.ok) {
                fetchTask(); // Component reload
                setShowCloseForm(false);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando incidencia...</div>;
    if (error) return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;
    if (!task) return null;

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <Button variant="ghost" className="p-2" onClick={() => router.back()}>
                        <ChevronLeft className="w-6 h-6 text-gray-600" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-gray-400">#{task.id}</span>
                            <TaskTypeBadge type={task.tipo} />
                            <TaskStateBadge state={task.estado} />
                            <TaskPriorityBadge priority={task.prioridad} />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight">
                            {task.titulo}
                        </h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4" />
                            Creado el {format(new Date(task.createdAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                            por <span className="font-bold text-gray-700">{task.creadoPor?.nombre}</span>
                        </p>
                    </div>
                </div>

                {/* ACTION BUTTONS (Only for Admin/Mechanic if Open) */}
                {task.estado !== 'CERRADA' && task.estado !== 'CANCELADA' && (
                    <div className="flex items-center gap-2">
                        {task.estado === 'ABIERTA' && (
                            <Button onClick={() => handleUpdateStatus('EN_CURSO')} className="bg-blue-600 hover:bg-blue-700 shadow-blue-200 shadow-lg text-white font-bold">
                                <Clock className="w-4 h-4 mr-2" /> MARCAR EN CURSO
                            </Button>
                        )}
                        {(task.estado === 'ABIERTA' || task.estado === 'EN_CURSO') && (
                            <Button onClick={() => setShowCloseForm(!showCloseForm)} className="bg-green-600 hover:bg-green-700 shadow-green-200 shadow-lg text-white font-bold">
                                <CheckCircle className="w-4 h-4 mr-2" /> RESOLVER INCIDENCIA
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* ERROR / CLOSURE FORM */}
            {showCloseForm && (
                <div className="bg-green-50 border border-green-200 p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
                    <h3 className="text-green-800 font-bold mb-2 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Cerrar Tarea
                    </h3>
                    <p className="text-sm text-green-700 mb-4">Por favor, describe la solución aplicada o el trabajo realizado.</p>
                    <textarea
                        className="w-full p-3 rounded-lg border border-green-300 focus:ring-2 focus:ring-green-500 min-h-[100px]"
                        placeholder="Se cambió la pieza X, se ajustó Y..."
                        value={resumenCierre}
                        onChange={(e) => setResumenCierre(e.target.value)}
                    ></textarea>
                    <div className="flex gap-2 mt-4 justify-end">
                        <Button variant="ghost" onClick={() => setShowCloseForm(false)}>Cancelar</Button>
                        <Button onClick={() => handleUpdateStatus('CERRADA')} className="bg-green-600 text-white font-bold">
                            CONFIRMAR CIERRE
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: INFO & DETAILS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* DESCRIPTION CARD */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4">Descripción</h2>
                        <div className="prose prose-sm max-w-none text-gray-600 space-y-4 whitespace-pre-wrap">
                            {task.descripcion}
                        </div>
                    </div>

                    {/* ASSET INFO CARD */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            {task.activoTipo === 'CAMION' && <Truck className="w-5 h-5 text-orange-500" />}
                            {task.activoTipo === 'DEPOSITO_CLIENTE' && <Building2 className="w-5 h-5 text-blue-500" />}
                            {task.activoTipo === 'BASE' && <MapPin className="w-5 h-5 text-purple-500" />}
                            Detalles del Activo
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {task.activoTipo === 'CAMION' && (
                                <>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">Matrícula</span>
                                        <span className="text-lg font-black text-gray-800">{task.matricula || 'N/A'}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">Modelo</span>
                                        <span className="text-lg font-medium text-gray-800">{task.camion?.modelo || 'Desconocido'}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">Ubicación / Taller</span>
                                        <span className="text-base font-medium text-gray-800">{task.ubicacionTexto || 'No especificada'}</span>
                                    </div>
                                    {/* Since KM was hacked into description or implicit, we might not show it structured unless we add fields */}
                                </>
                            )}

                            {task.activoTipo === 'DEPOSITO_CLIENTE' && (
                                <>
                                    <div className="bg-gray-50 p-3 rounded-lg md:col-span-2">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">Cliente</span>
                                        <span className="text-lg font-bold text-gray-800">{task.clienteNombre}</span>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg md:col-span-2">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">Ubicación</span>
                                        <span className="text-base font-medium text-gray-800">{task.ubicacionTexto}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* CONTACT INFO */}
                        {(task.contactoNombre || task.contactoTelefono) && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <span className="block text-xs font-bold text-gray-400 uppercase mb-2">Contacto Reportado</span>
                                <div className="flex items-center gap-4">
                                    {task.contactoNombre && (
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <User className="w-4 h-4 text-gray-400" /> {task.contactoNombre}
                                        </div>
                                    )}
                                    {task.contactoTelefono && (
                                        <div className="flex items-center gap-2 text-sm text-gray-700 font-mono">
                                            📞 {task.contactoTelefono}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CLOSURE SUMMARY (IF CLOSED) */}
                    {task.estado === 'CERRADA' && task.resumenCierre && (
                        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                            <h2 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5" /> Resolución
                            </h2>
                            <p className="text-green-800 whitespace-pre-wrap">{task.resumenCierre}</p>
                            {task.fechaCierre && (
                                <p className="text-xs text-green-600 mt-2">
                                    Cerrado el {format(new Date(task.fechaCierre), "d 'de' MMMM yyyy", { locale: es })}
                                </p>
                            )}
                        </div>
                    )}

                </div>

                {/* RIGHT COLUMN: CRM */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <TaskCRM task={task} onUpdate={fetchTask} />
                    </div>
                </div>
            </div>
        </div>
    );
}
