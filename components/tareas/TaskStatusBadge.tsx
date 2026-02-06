import { Badge } from "@/components/ui/Badge";
import { AlertCircle, Wrench, FileText, CheckCircle, XCircle, Clock } from "lucide-react";

export function TaskTypeBadge({ type }: { type: string }) {
    switch (type) {
        case 'AVERIA':
            return <Badge variant="destructive" className="flex items-center gap-1"><Wrench className="w-3 h-3" /> Avería</Badge>;
        case 'TAREA_INTERNA':
            return <Badge variant="outline" className="flex items-center gap-1 border-blue-500 text-blue-600 bg-blue-50"><FileText className="w-3 h-3" /> Interna</Badge>;
        case 'MANTENIMIENTO':
            return <Badge variant="outline" className="flex items-center gap-1 border-purple-500 text-purple-600 bg-purple-50"><Clock className="w-3 h-3" /> Mantenimiento</Badge>;
        default:
            return <Badge variant="secondary">{type}</Badge>;
    }
}

export function TaskStateBadge({ state }: { state: string }) {
    switch (state) {
        case 'ABIERTA':
            return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200">Abierta</Badge>;
        case 'EN_CURSO':
            return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200 flex items-center gap-1"><Clock className="w-3 h-3" /> En Curso</Badge>;
        case 'CERRADA':
            return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Cerrada</Badge>;
        case 'CANCELADA':
            return <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelada</Badge>;
        default:
            return <Badge variant="outline">{state}</Badge>;
    }
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
    switch (priority) {
        case 'BAJA':
            return <span className="text-xs font-bold text-gray-500">Baja</span>;
        case 'MEDIA':
            return <span className="text-xs font-bold text-blue-500">Media</span>;
        case 'ALTA':
            return <span className="text-xs font-bold text-orange-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alta</span>;
        case 'URGENTE':
            return <span className="text-xs font-bold text-red-600 animate-pulse flex items-center gap-1"><AlertCircle className="w-4 h-4" /> URGENTE</span>;
        default:
            return <span className="text-xs text-gray-400">{priority}</span>;
    }
}
