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
    MoreHorizontal
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

export function TaskCard({ task, onMove, onClick }: TaskCardProps) {
    const isUrgent = task.prioridad === 'URGENTE';

    // Derived state for visual coding
    const borderColor = isUrgent ? 'border-l-red-500' :
        task.prioridad === 'ALTA' ? 'border-l-orange-500' :
            task.prioridad === 'MEDIA' ? 'border-l-blue-500' : 'border-l-green-500';

    return (
        <Card
            className={`mb-3 cursor-pointer hover:shadow-md transition-all border-l-4 ${borderColor} bg-white shadow-sm`}
            onClick={() => onClick(task.id)}
        >
            <CardContent className="p-3 space-y-3">

                {/* Header: Type and Priority */}
                <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                        <TaskTypeBadge type={task.tipo} />
                        {isUrgent && (
                            <span className="text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded animate-pulse">
                                URGENTE
                            </span>
                        )}
                    </div>

                    {/* Quick Actions Menu */}
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Mover a...</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'PENDIENTE')}>
                                    <AlertCircle className="mr-2 h-4 w-4" /> Pendiente
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'EN_CURSO')}>
                                    <PlayCircle className="mr-2 h-4 w-4" /> En Proceso
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onMove(task.id, 'COMPLETADA')}>
                                    <CheckCircle className="mr-2 h-4 w-4" /> Hecho
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Title */}
                <div>
                    <h4 className="text-sm font-bold text-gray-800 leading-tight line-clamp-2">
                        {task.titulo}
                    </h4>
                    <span className="text-[10px] text-gray-400 font-mono">#{task.id}</span>
                </div>

                {/* Context Info (Vehicle/Client) */}
                {task.matricula && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 p-1.5 rounded">
                        <Truck className="w-3.5 h-3.5" />
                        <span className="font-semibold">{task.matricula}</span>
                    </div>
                )}
                {task.clienteNombre && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 p-1.5 rounded">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-semibold line-clamp-1">{task.clienteNombre}</span>
                    </div>
                )}

                {/* Footer: Avatar & Time */}
                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 text-gray-500" title={task.asignadoA?.nombre || "Sin asignar"}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${task.asignadoA ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            {task.asignadoA ? task.asignadoA.nombre.charAt(0) : '?'}
                        </div>
                        {task.asignadoA && <span className="text-[10px] max-w-[80px] truncate">{task.asignadoA.nombre}</span>}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Clock className="w-3 h-3" />
                        {tryFormatDistance(task.createdAt)}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function tryFormatDistance(dateString: string) {
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: es });
    } catch (e) {
        return 'Hace un momento';
    }
}
