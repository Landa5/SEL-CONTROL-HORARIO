import { Badge } from "@/components/ui/Badge";
import { AlertCircle, Wrench, FileText, CheckCircle, XCircle, Clock, Repeat, Zap, PauseCircle, Search, Shield, Cog } from "lucide-react";

export function TaskTypeBadge({ type }: { type: string }) {
    const config: Record<string, { icon: any; label: string; gradient: string; className: string }> = {
        TALLER: {
            icon: Wrench, label: 'Taller',
            gradient: 'from-orange-500 to-amber-500',
            className: 'text-white shadow-sm shadow-orange-200',
        },
        RECLAMACION: {
            icon: Shield, label: 'Reclamación',
            gradient: 'from-purple-500 to-fuchsia-500',
            className: 'text-white shadow-sm shadow-purple-200',
        },
        OPERATIVA: {
            icon: Cog, label: 'Operativa',
            gradient: 'from-blue-500 to-indigo-500',
            className: 'text-white shadow-sm shadow-blue-200',
        },
        ADMINISTRATIVA: {
            icon: FileText, label: 'Admin',
            gradient: 'from-cyan-500 to-teal-500',
            className: 'text-white shadow-sm shadow-cyan-200',
        },
        RECURRENTE: {
            icon: Repeat, label: 'Recurrente',
            gradient: 'from-violet-500 to-purple-500',
            className: 'text-white shadow-sm shadow-violet-200',
        },
        AUTOMATICA: {
            icon: Zap, label: 'Auto',
            gradient: 'from-gray-500 to-slate-500',
            className: 'text-white shadow-sm shadow-gray-200',
        },
    };

    const c = config[type];
    if (!c) return <Badge variant="secondary" className="text-[10px]">{type}</Badge>;

    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r ${c.gradient} ${c.className}`}>
            <Icon className="w-3 h-3" /> {c.label}
        </span>
    );
}

export function TaskStateBadge({ state }: { state: string }) {
    switch (state) {
        case 'BACKLOG':
            return <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50/50">Backlog</Badge>;
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
