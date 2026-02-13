'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, User, Truck, MapPin, AlertCircle, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge'; // Assuming we might have a Badge component, or I'll use standard classes
import TaskCRM from './TaskCRM';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskDetailPanelProps {
    taskId: number | null;
    onClose: () => void;
    onUpdate: () => void;
}

export default function TaskDetailPanel({ taskId, onClose, onUpdate }: TaskDetailPanelProps) {
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (taskId) {
            fetchTaskDetails(taskId);
        } else {
            setTask(null);
        }
    }, [taskId]);

    const fetchTaskDetails = async (id: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/tareas/${id}`);
            if (res.ok) {
                const data = await res.json();
                setTask(data);
            }
        } catch (error) {
            console.error("Error fetching task details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!task) return;
        try {
            const res = await fetch(`/api/tareas/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus })
            });
            if (res.ok) {
                fetchTaskDetails(task.id);
                onUpdate();
            }
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    if (!taskId) return null;

    const isOpen = !!taskId;

    return (
        <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative w-full max-w-2xl bg-white h-full shadow-2xl transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-5 h-5 text-gray-500" />
                        </Button>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">
                                #{task?.id} • {task?.tipo}
                            </p>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                {task?.titulo || 'Cargando...'}
                            </h2>
                        </div>
                    </div>
                    {task && (
                        <div className="flex gap-2">
                            <select
                                className="text-xs font-bold uppercase bg-gray-100 border-none rounded-lg p-2 cursor-pointer hover:bg-gray-200"
                                value={task.estado}
                                onChange={(e) => handleStatusChange(e.target.value)}
                            >
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="ABIERTA">Abierta</option>
                                <option value="EN_CURSO">En Curso</option>
                                <option value="BLOQUEADA">Bloqueada</option>
                                <option value="REVISION">Revisión</option>
                                <option value="COMPLETADA">Completada</option>
                                <option value="CERRADA">Cerrada</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Content */}
                {loading || !task ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-gray-50/50">
                        <div className="p-6 space-y-6">

                            {/* Main Info */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-2">Descripción</h3>
                                    <p className="text-gray-600 text-sm whitespace-pre-wrap">{task.descripcion}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className={`w-4 h-4 ${task.prioridad === 'ALTA' || task.prioridad === 'URGENTE' ? 'text-red-500' : 'text-gray-400'}`} />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Prioridad</p>
                                            <p className="text-sm font-medium">{task.prioridad}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Fecha Reporte</p>
                                            <p className="text-sm font-medium">{format(new Date(task.createdAt), 'dd MMM yyyy', { locale: es })}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Context Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {task.matricula && (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Truck className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase">Vehículo</p>
                                            <p className="font-bold text-blue-900">{task.matricula}</p>
                                        </div>
                                    </div>
                                )}
                                {task.creadoPor && (
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center gap-3">
                                        <div className="p-2 bg-gray-200 rounded-lg">
                                            <User className="w-5 h-5 text-gray-600" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Reportado por</p>
                                            <p className="font-bold text-gray-700">{task.creadoPor.nombre}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Location & Contact */}
                            {(task.ubicacionTexto || task.contactoNombre) && (
                                <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase">Ubicación y Contacto</h4>
                                    {task.ubicacionTexto && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                                            <span className="text-sm text-gray-700">{task.ubicacionTexto}</span>
                                        </div>
                                    )}
                                    {task.contactoNombre && (
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-700">{task.contactoNombre}</span>
                                            {task.contactoTelefono && (
                                                <>
                                                    <span className="text-gray-300">|</span>
                                                    <Phone className="w-3 h-3 text-gray-400" />
                                                    <span className="text-sm text-gray-700">{task.contactoTelefono}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CRM / History */}
                            <div className="pt-2">
                                <h3 className="text-sm font-bold text-gray-900 mb-3">Actividad y Comentarios</h3>
                                <div className="h-[400px]">
                                    <TaskCRM task={task} onUpdate={() => {
                                        fetchTaskDetails(task.id);
                                        onUpdate();
                                    }} />
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
