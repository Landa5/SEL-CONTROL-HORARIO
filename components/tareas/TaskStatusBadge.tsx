import { Badge } from "@/components/ui/Badge";
import { AlertCircle, Wrench, FileText, CheckCircle, XCircle, Clock, Repeat, Zap, PauseCircle, Search } from "lucide-react";

export function TaskTypeBadge({ type }: { type: string }) {
    switch (type) {
        case 'OPERATIVA':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"><Wrench className="w-3 h-3" /> Operativa</Badge>;
        case 'ADMINISTRATIVA':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"><FileText className="w-3 h-3" /> Admin</Badge>;
        case 'RECURRENTE':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"><Repeat className="w-3 h-3" /> Recurrente</Badge>;
        case 'AUTOMATICA':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200"><Zap className="w-3 h-3" /> Auto</Badge>;
        case 'TALLER':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200"><Wrench className="w-3 h-3" /> Taller</Badge>;
        case 'RECLAMACION':
            return <Badge variant="secondary" className="flex items-center gap-1 bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200"><AlertCircle className="w-3 h-3" /> Reclamación</Badge>;
        default:
            return <Badge variant="secondary">{type}</Badge>;
    }
}

export function TaskStateBadge({ state }: { state: string }) {
    switch (state) {
        case 'BACKLOG':
            return <Badge variant="outline" className="text-gray-500 border-gray-300">Backlog</Badge>;
        case 'PENDIENTE':
            return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Pendiente</Badge>;
        case 'EN_CURSO':
            return <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1"><Clock className="w-3 h-3" /> En Curso</Badge>;
        case 'BLOQUEADA':
            return <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1"><PauseCircle className="w-3 h-3" /> Bloqueada</Badge>;
        case 'REVISION':
            return <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1"><Search className="w-3 h-3" /> Revisión</Badge>;
        case 'COMPLETADA':
            return <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completada</Badge>;
        case 'CANCELADA':
            return <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-gray-200 flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelada</Badge>;
        default:
            return <Badge variant="outline">{state}</Badge>;
    }
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
    switch (priority) {
        case 'BAJA':
            return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Baja</Badge>;
        case 'MEDIA':
            return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Media</Badge>;
        case 'ALTA':
            return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alta</Badge>;
        default:
            return <span className="text-xs text-gray-400">{priority}</span>;
    }
}
