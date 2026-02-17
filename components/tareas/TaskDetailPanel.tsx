'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, User, Truck, MapPin, AlertCircle, Phone, ArrowRight, Pencil, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import TaskCRM from './TaskCRM';
import TaskForm from './TaskForm';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskDetailPanelProps {
    taskId: number | null;
    onClose: () => void;
    onUpdate: () => void;
}

// Simple Resolution Modal Component
function ResolutionModal({ isOpen, onClose, onConfirm, loading, taskType }: any) {
    const [resultado, setResultado] = useState('SOLUCIONADO');
    const [conclusion, setConclusion] = useState('');

    // TALLER specific fields
    const [coste, setCoste] = useState('');
    const [kmActual, setKmActual] = useState('');

    if (!isOpen) return null;

    const isTaller = taskType === 'TALLER';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-gray-900">
                    {isTaller ? 'Finalizar Reparación / Taller' : 'Finalizar Tarea'}
                </h3>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Resultado</label>
                    <select
                        className="w-full p-2 border rounded-lg"
                        value={resultado}
                        onChange={(e) => setResultado(e.target.value)}
                    >
                        <option value="SOLUCIONADO">Solucionado / Reparado</option>
                        <option value="NO_PROCEDE">No Procede / Falsa Alarma</option>
                        <option value="PARCIAL">Solución Parcial (Pendiente Piezas)</option>
                    </select>
                </div>

                {isTaller && (
                    <div className="grid grid-cols-2 gap-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-orange-800 uppercase">Coste Final (€)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                className="w-full p-2 border border-orange-200 rounded-lg text-sm"
                                value={coste}
                                onChange={(e) => setCoste(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-orange-800 uppercase">Kms Actuales</label>
                            <input
                                type="number"
                                placeholder="Ej: 150000"
                                className="w-full p-2 border border-orange-200 rounded-lg text-sm"
                                value={kmActual}
                                onChange={(e) => setKmActual(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Conclusión / Detalles</label>
                    <textarea
                        className="w-full p-2 border rounded-lg"
                        rows={3}
                        placeholder={isTaller ? "Detalla las piezas cambiadas y el trabajo realizado..." : "Explica brevemente la solución aplicada..."}
                        value={conclusion}
                        onChange={(e) => setConclusion(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button
                        onClick={() => onConfirm(resultado, conclusion, { coste, kmActual })}
                        disabled={loading || !conclusion.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {loading ? 'Guardando...' : 'Confirmar Cierre'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function TaskDetailPanel({ taskId, onClose, onUpdate }: TaskDetailPanelProps) {
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isAdminOrOffice, setIsAdminOrOffice] = useState(false);
    const [userRole, setUserRole] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [showResolutionModal, setShowResolutionModal] = useState(false);

    // Fetch employees for assignment
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await fetch('/api/empleados'); // Assuming this endpoint returns all active employees
                if (res.ok) {
                    const data = await res.json();
                    setEmployees(data);
                }
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };

        fetchEmployees();

        // Get session to check role
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(session => {
                if (session?.rol) setUserRole(session.rol);
                if (session?.rol === 'ADMIN' || session?.rol === 'OFICINA') {
                    setIsAdminOrOffice(true);
                }
            })
            .catch(err => console.error(err));

    }, []);

    useEffect(() => {
        if (taskId) {
            fetchTaskDetails(taskId);
            setIsEditing(false); // Reset edit mode when opening new task
        } else {
            setTask(null);
            setIsEditing(false);
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

    const handleAssigneeChange = async (newAssigneeId: string) => {
        if (!task) return;
        const assigneeId = newAssigneeId === 'unassigned' ? null : Number(newAssigneeId);

        try {
            const res = await fetch(`/api/tareas/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asignadoAId: assigneeId })
            });
            if (res.ok) {
                fetchTaskDetails(task.id);
                onUpdate();
            }
        } catch (error) {
            console.error("Error updating assignee:", error);
        }
    };

    const handleCloseTask = async (resultado: string, conclusion: string, extraData?: { coste?: string, kmActual?: string }) => {
        if (!task) return;
        setLoading(true);
        try {
            // 1. Add History/Comment
            await fetch(`/api/tareas/${task.id}/historial`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipoAccion: 'CIERRE',
                    mensaje: `TAREA FINALIZADA. Resultado: ${resultado}. Detalles: ${conclusion}`
                })
            });

            // 2. Update Status to COMPLETADA
            const res = await fetch(`/api/tareas/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    estado: 'COMPLETADA',
                    resumenCierre: conclusion,
                    mantenimientoData: extraData // Send extra data to backend to create MantenimientoRealizado if needed
                })
            });

            if (res.ok) {
                setShowResolutionModal(false);
                fetchTaskDetails(task.id);
                onUpdate();
            }
        } catch (error) {
            console.error("Error closing task:", error);
        } finally {
            setLoading(false);
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

                <ResolutionModal
                    isOpen={showResolutionModal}
                    onClose={() => setShowResolutionModal(false)}
                    onConfirm={handleCloseTask}
                    loading={loading}
                    taskType={task?.tipo}
                />

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-white z-10">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="w-5 h-5 text-gray-500" />
                        </Button>
                        <div>
                            {loading ? (
                                <p className="text-sm font-medium text-gray-400">Cargando...</p>
                            ) : isEditing ? (
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="p-0 h-auto">
                                        <ArrowLeft className="w-4 h-4 mr-1" /> Volver
                                    </Button>
                                    <h2 className="text-lg font-bold text-gray-900">Editar Tarea</h2>
                                </div>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-gray-400 uppercase">
                                        #{task?.id} • {task?.tipo}
                                    </p>
                                    <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                        {task?.titulo || '...'}
                                    </h2>
                                </>
                            )}
                        </div>
                    </div>

                    {!loading && task && (
                        <div className="flex gap-2">
                            {!isEditing && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsEditing(true)}
                                    className="hidden sm:flex"
                                >
                                    <Pencil className="w-4 h-4 mr-2" /> Editar
                                </Button>
                            )}

                            {/* Mobile Edit Icon */}
                            {!isEditing && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsEditing(true)}
                                    className="sm:hidden"
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            )}

                            {!isEditing && (
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
                            )}
                        </div>
                    )}

                    {/* CLOSE BUTTON - Only if Active */}
                    {!loading && task && task.estado !== 'COMPLETADA' && task.estado !== 'CERRADA' && !isEditing && (
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white shadow-sm animate-in fade-in"
                            onClick={() => setShowResolutionModal(true)}
                        >
                            Finalizar Tarea
                        </Button>
                    )}
                </div>

                {/* Content */}
                {loading || !task ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : isEditing ? (
                    <div className="flex-1 overflow-y-auto bg-gray-50">
                        <TaskForm
                            rol={userRole}
                            initialData={task}
                            onSuccess={() => {
                                setIsEditing(false);
                                fetchTaskDetails(task.id);
                                onUpdate();
                            }}
                        />
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

                            {/* Assignment Section - Only visible for Admin/Office or if assigned */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase">Asignación</h4>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <User className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div className="flex-1">
                                        {isAdminOrOffice ? (
                                            <select
                                                className="w-full text-sm font-medium text-gray-900 border-none bg-transparent focus:ring-0 cursor-pointer"
                                                value={task.asignadoAId || 'unassigned'}
                                                onChange={(e) => handleAssigneeChange(e.target.value)}
                                            >
                                                <option value="unassigned">Sin asignar</option>
                                                {employees.map(emp => (
                                                    <option key={emp.id} value={emp.id}>
                                                        {emp.nombre} {emp.apellidos}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Asignado a</p>
                                                <p className="font-bold text-gray-700">{task.asignadoA?.nombre || 'Sin asignar'}</p>
                                            </div>
                                        )}
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
