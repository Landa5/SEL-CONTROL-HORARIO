import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, AlertCircle, CheckCircle, Clock, User, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface TaskCardProps {
    task: any; // Using any for now to avoid strict type issues during transition
}

const PriorityBadge = ({ priority }: { priority: string }) => {
    switch (priority) {
        case 'ALTA': return <Badge className="bg-red-100 text-red-800 border-red-200">Alta</Badge>;
        case 'MEDIA': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Media</Badge>;
        case 'BAJA': return <Badge className="bg-green-100 text-green-800 border-green-200">Baja</Badge>;
        default: return <Badge variant="outline">{priority}</Badge>;
    }
};

const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
        case 'BACKLOG': return <Badge variant="outline" className="text-gray-500">Backlog</Badge>;
        case 'PENDIENTE': return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Pendiente</Badge>;
        case 'EN_CURSO': return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 animate-pulse">En Curso</Badge>;
        case 'BLOQUEADA': return <Badge className="bg-red-50 text-red-600 border-red-200">Bloqueada</Badge>;
        case 'REVISION': return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Revisión</Badge>;
        case 'COMPLETADA': return <Badge className="bg-green-100 text-green-800 border-green-200">Completada</Badge>;
        case 'CANCELADA': return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Cancelada</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
};

export default function TaskCard({ task }: TaskCardProps) {
    const isOverdue = task.fechaLimite && new Date(task.fechaLimite) < new Date() && task.estado !== 'COMPLETADA' && task.estado !== 'CANCELADA';
    const isBlocked = task.estado === 'BLOQUEADA';

    return (
        <Link href={`/admin/tareas/${task.id}`}>
            <div className={`
                relative p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all group
                ${isBlocked ? 'border-red-300 bg-red-50/10' : 'border-gray-200'}
            `}>
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">#{task.id}</span>
                        <PriorityBadge priority={task.prioridad} />
                    </div>
                    <StatusBadge status={task.estado} />
                </div>

                {/* Title */}
                <h3 className={`font-semibold text-gray-900 mb-1 line-clamp-2 ${task.estado === 'COMPLETADA' ? 'line-through text-gray-500' : ''}`}>
                    {task.titulo}
                </h3>

                {/* Meta */}
                <div className="space-y-2 mt-3 text-xs text-gray-500">

                    {/* Assignee & Type */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                                <User className="w-3 h-3" />
                            </div>
                            <span className="font-medium text-gray-700">
                                {task.asignadoA ? task.asignadoA.nombre : <span className="text-orange-500 italic">Sin asignar</span>}
                            </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-gray-50 border text-[10px] uppercase font-bold tracking-wider">
                            {task.tipo}
                        </span>
                    </div>

                    {/* Creation Info */}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(task.createdAt), "d MMM", { locale: es })}</span>
                        <span>•</span>
                        <span>{task.creadoPor?.nombre || 'Desconocido'}</span>
                    </div>

                    {/* Due Date */}
                    {task.fechaLimite && (
                        <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(task.fechaLimite), "d MMM", { locale: es })}
                            {isOverdue && <span className="text-[10px] bg-red-100 px-1 rounded">VENCIDA</span>}
                        </div>
                    )}

                    {/* Block Reason */}
                    {isBlocked && task.motivoBloqueo && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <p className="line-clamp-2">{task.motivoBloqueo}</p>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
