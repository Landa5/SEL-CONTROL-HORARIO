'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/Badge'; // Ensure this exists or use span classes
import { AlertCircle, Clock, Truck, User } from 'lucide-react';

interface TaskListProps {
    tasks: any[];
    onTaskClick: (taskId: number) => void;
}

const statusColors: any = {
    'PENDIENTE': 'bg-gray-100 text-gray-800',
    'ABIERTA': 'bg-blue-100 text-blue-800',
    'EN_CURSO': 'bg-yellow-100 text-yellow-800',
    'BLOQUEADA': 'bg-red-100 text-red-800',
    'REVISION': 'bg-purple-100 text-purple-800',
    'COMPLETADA': 'bg-green-100 text-green-800',
    'CERRADA': 'bg-gray-200 text-gray-600',
};

const priorityColors: any = {
    'BAJA': 'text-gray-500',
    'MEDIA': 'text-blue-500',
    'ALTA': 'text-orange-500',
    'URGENTE': 'text-red-600 font-bold',
};

export default function TaskList({ tasks, onTaskClick }: TaskListProps) {
    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-xl border border-dashed">
                <p>No hay tareas que mostrar</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                        <tr>
                            <th className="p-4 w-20">ID</th>
                            <th className="p-4">Título / Descripción</th>
                            <th className="p-4 w-32">Estado</th>
                            <th className="p-4 w-32">Prioridad</th>
                            <th className="p-4 w-40">Asignado</th>
                            <th className="p-4 w-40">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {tasks.map((task) => (
                            <tr
                                key={task.id}
                                onClick={() => onTaskClick(task.id)}
                                className="hover:bg-blue-50 cursor-pointer transition-colors group"
                            >
                                <td className="p-4 font-mono text-gray-400 group-hover:text-blue-600">
                                    #{task.id}
                                </td>
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 mb-1">{task.titulo}</span>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {task.matricula && (
                                                <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                                    <Truck className="w-3 h-3" /> {task.matricula}
                                                </span>
                                            )}
                                            {task.creadoPor && (
                                                <span className="flex items-center gap-1">
                                                    Reportado por: {task.creadoPor.nombre}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${statusColors[task.estado] || 'bg-gray-100'}`}>
                                        {task.estado.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-1">
                                        <AlertCircle className={`w-4 h-4 ${priorityColors[task.prioridad]}`} />
                                        <span className={`text-xs font-bold ${priorityColors[task.prioridad]}`}>
                                            {task.prioridad}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {task.asignadoA ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                                {task.asignadoA.nombre.charAt(0)}
                                            </div>
                                            <span className="text-gray-700">{task.asignadoA.nombre}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">Sin asignar</span>
                                    )}
                                </td>
                                <td className="p-4 text-gray-500">
                                    <div className="flex flex-col text-xs">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(task.createdAt), 'dd MMM', { locale: es })}
                                        </span>
                                        <span className="text-[10px] text-gray-400">
                                            {format(new Date(task.createdAt), 'HH:mm')}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
