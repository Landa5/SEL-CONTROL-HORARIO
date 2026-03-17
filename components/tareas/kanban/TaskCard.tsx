import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
    Clock,
    Truck,
    User,
    ArrowRight,
    CheckCircle,
    PlayCircle,
    AlertCircle,
    Building2,
    MapPin,
    MoreHorizontal,
    Wrench,
    Shield,
    AlertTriangle,
    Users
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { TaskTypeBadge, TaskPriorityBadge } from "../TaskStatusBadge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface TaskCardProps {
    task: any;
    onMove: (taskId: number, newState: string) => void;
    onClick: (taskId: number) => void;
}

const TYPE_GRADIENT: Record<string, string> = {
    TALLER: 'from-orange-500 via-amber-500 to-orange-600',
    RECLAMACION: 'from-purple-500 via-fuchsia-500 to-purple-600',
    OPERATIVA: 'from-blue-500 via-indigo-500 to-blue-600',
    ADMINISTRATIVA: 'from-cyan-500 via-teal-500 to-cyan-600',
};

const TYPE_BG: Record<string, string> = {
    TALLER: 'bg-gradient-to-br from-orange-50 to-amber-50/50',
    RECLAMACION: 'bg-gradient-to-br from-purple-50 to-fuchsia-50/50',
    OPERATIVA: 'bg-gradient-to-br from-blue-50 to-indigo-50/50',
    ADMINISTRATIVA: 'bg-gradient-to-br from-cyan-50 to-teal-50/50',
};

export function TaskCard({ task, onMove, onClick }: TaskCardProps) {
    const isUrgent = task.prioridad === 'URGENTE';
    const isAlta = task.prioridad === 'ALTA';
    const gradient = TYPE_GRADIENT[task.tipo] || 'from-slate-400 to-slate-500';
    const cardBg = TYPE_BG[task.tipo] || 'bg-white';
    const hasParticipants = task.participantes?.length > 0;

    return (
        <div
            className={`group relative mb-3 cursor-pointer rounded-xl overflow-hidden transition-all duration-300 
                hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:scale-[1.01]
                ${isUrgent ? 'ring-2 ring-red-400/60 ring-offset-1' : ''}
                ${cardBg} border border-white/60 shadow-sm backdrop-blur-sm`}
            onClick={() => onClick(task.id)}
        >
            {/* Top gradient accent bar */}
            <div className={`h-1 bg-gradient-to-r ${gradient}`} />

            <div className="p-3.5 space-y-2.5">
                {/* Header: Type badge + Priority + Actions */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <TaskTypeBadge type={task.tipo} />
                        {isUrgent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-gradient-to-r from-red-500 to-rose-500 text-white px-2 py-0.5 rounded-full shadow-sm shadow-red-200 animate-pulse">
                                <AlertTriangle className="w-3 h-3" /> URGENTE
                            </span>
                        )}
                        {isAlta && !isUrgent && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                ALTA
                            </span>
                        )}
                    </div>

                    {/* Quick Actions Menu */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-0">
                                <DropdownMenuLabel className="text-xs text-gray-400">Mover a...</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'PENDIENTE')} className="rounded-lg">
                                    <AlertCircle className="mr-2 h-4 w-4 text-slate-500" /> Pendiente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'EN_CURSO')} className="rounded-lg">
                                    <PlayCircle className="mr-2 h-4 w-4 text-blue-500" /> En Proceso
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'COMPLETADA')} className="rounded-lg">
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Hecho
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Title */}
                <div>
                    <h4 className="text-sm font-bold text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-950 transition-colors">
                        {task.titulo}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-mono mt-0.5 inline-block">#{task.id}</span>
                </div>

                {/* Context: Vehicle / Client / Participants */}
                <div className="space-y-1.5">
                    {task.matricula && (
                        <div className="flex items-center gap-1.5 text-xs bg-white/70 backdrop-blur rounded-lg px-2 py-1.5 border border-slate-100">
                            <Truck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="font-bold text-slate-700">{task.matricula}</span>
                        </div>
                    )}
                    {task.clienteNombre && (
                        <div className="flex items-center gap-1.5 text-xs bg-white/70 backdrop-blur rounded-lg px-2 py-1.5 border border-blue-100">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                            <span className="font-semibold text-indigo-700 line-clamp-1">{task.clienteNombre}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-end pt-2 border-t border-gray-100/80">
                    {/* Left: People */}
                    <div className="flex items-center gap-2">
                        {/* Assignee avatar */}
                        <div className="flex items-center gap-1.5" title={task.asignadoA?.nombre || "Sin asignar"}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ring-2 ring-white shadow-sm ${
                                task.asignadoA ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-300'
                            }`}>
                                {task.asignadoA ? task.asignadoA.nombre.charAt(0) : '?'}
                            </div>
                            {task.asignadoA && (
                                <span className="text-[11px] text-gray-600 font-medium max-w-[70px] truncate">
                                    {task.asignadoA.nombre}
                                </span>
                            )}
                        </div>

                        {/* Participant count */}
                        {hasParticipants && (
                            <div className="flex items-center gap-0.5 text-[10px] text-gray-400" title={`${task.participantes.length} participantes`}>
                                <Users className="w-3 h-3" />
                                <span className="font-bold">{task.participantes.length}</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Date */}
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                            <Clock className="w-3 h-3" />
                            {format(new Date(task.createdAt), 'dd MMM', { locale: es })}
                        </div>
                        <span className="text-[9px] text-gray-300">
                            {tryFormatDistance(task.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function tryFormatDistance(dateString: string) {
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
    } catch (e) {
        return 'Hace un momento';
    }
}
