import React, { useState, useMemo } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/Table";
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    FileText, CheckCircle, XCircle, Trash2, Calendar, Clock,
    Sun, Thermometer, ArrowRight, Filter, Pencil, AlertCircle,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { useRouter } from 'next/navigation';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface EmployeeSimple {
    id: number;
    nombre: string;
    apellidos: string | null;
    rol: string;
}

interface Absence {
    id: number;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    horas?: number | null;
    justificanteUrl?: string | null;
    empleado: EmployeeSimple;
}

interface AbsenceHistoryTableProps {
    history: Absence[];
}

const TYPE_CONFIG: Record<string, { icon: typeof Sun; label: string; badge: string; }> = {
    VACACIONES: { icon: Sun, label: 'Vacaciones', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    BAJA:       { icon: Thermometer, label: 'Baja', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    PERMISO:    { icon: FileText, label: 'Permiso', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    OTROS:      { icon: Calendar, label: 'Otros', badge: 'bg-gray-50 text-gray-700 border-gray-200' },
};

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; badge: string; row: string; }> = {
    PENDIENTE: { icon: Clock, label: 'Pendiente', badge: 'bg-amber-100 text-amber-700', row: 'bg-amber-50/40' },
    APROBADA:  { icon: CheckCircle, label: 'Aprobada', badge: 'bg-green-100 text-green-700', row: '' },
    DENEGADA:  { icon: XCircle, label: 'Denegada', badge: 'bg-red-100 text-red-600', row: 'bg-red-50/30' },
};

export default function AbsenceHistoryTable({ history }: AbsenceHistoryTableProps) {
    const router = useRouter();
    const [filterType, setFilterType] = useState<string>('TODOS');
    const [filterState, setFilterState] = useState<string>('TODOS');
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [showPendingFirst, setShowPendingFirst] = useState(true);

    // Edit State
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        fechaInicio: '',
        fechaFin: '',
        tipo: 'VACACIONES',
        observaciones: ''
    });

    const filteredHistory = useMemo(() => {
        let filtered = history.filter(abs => {
            if (filterType !== 'TODOS' && abs.tipo !== filterType) return false;
            if (filterState !== 'TODOS' && abs.estado !== filterState) return false;
            return true;
        });

        if (showPendingFirst) {
            filtered = [...filtered].sort((a, b) => {
                if (a.estado === 'PENDIENTE' && b.estado !== 'PENDIENTE') return -1;
                if (a.estado !== 'PENDIENTE' && b.estado === 'PENDIENTE') return 1;
                return new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime();
            });
        }

        return filtered;
    }, [history, filterType, filterState, showPendingFirst]);

    // Count by status/type for filter pills
    const counts = useMemo(() => ({
        total: history.length,
        pendiente: history.filter(a => a.estado === 'PENDIENTE').length,
        aprobada: history.filter(a => a.estado === 'APROBADA').length,
        denegada: history.filter(a => a.estado === 'DENEGADA').length,
        vacaciones: history.filter(a => a.tipo === 'VACACIONES').length,
        baja: history.filter(a => a.tipo === 'BAJA').length,
        permiso: history.filter(a => a.tipo === 'PERMISO').length,
    }), [history]);

    const handleUpdateStatus = async (id: number, newStatus: 'APROBADA' | 'DENEGADA') => {
        setProcessingId(id);
        try {
            const res = await fetch(`/api/ausencias/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: newStatus })
            });

            if (res.ok) {
                toast.success(`Solicitud ${newStatus.toLowerCase()} correctamente`);
                window.location.reload();
            } else {
                toast.error("Error al actualizar la solicitud");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setProcessingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta ausencia permanentemente?')) return;

        setProcessingId(id);
        try {
            const res = await fetch(`/api/ausencias/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success("Ausencia eliminada");
                window.location.reload();
            } else {
                toast.error("Error al eliminar");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setProcessingId(null);
        }
    };

    const openEditDialog = (absence: Absence) => {
        setEditingAbsence(absence);
        setEditForm({
            fechaInicio: format(new Date(absence.fechaInicio), 'yyyy-MM-dd'),
            fechaFin: format(new Date(absence.fechaFin), 'yyyy-MM-dd'),
            tipo: absence.tipo,
            observaciones: ''
        });
        setIsEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingAbsence) return;
        setProcessingId(editingAbsence.id);

        try {
            const res = await fetch(`/api/ausencias/${editingAbsence.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaInicio: editForm.fechaInicio,
                    fechaFin: editForm.fechaFin,
                    tipo: editForm.tipo,
                    observaciones: editForm.observaciones || undefined
                })
            });

            if (res.ok) {
                toast.success("Ausencia actualizada");
                setIsEditDialogOpen(false);
                window.location.reload();
            } else {
                toast.error("Error al actualizar");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* ─── Header con filtros ─── */}
            <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400" />
                            Historial y Solicitudes
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {filteredHistory.length} de {history.length} registros
                        </p>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap gap-1.5">
                        {/* Status Filters */}
                        {([
                            { key: 'TODOS', label: 'Todos', count: counts.total, color: 'bg-gray-100 text-gray-700 border-gray-200' },
                            { key: 'PENDIENTE', label: 'Pendientes', count: counts.pendiente, color: 'bg-amber-100 text-amber-700 border-amber-200' },
                            { key: 'APROBADA', label: 'Aprobadas', count: counts.aprobada, color: 'bg-green-100 text-green-700 border-green-200' },
                            { key: 'DENEGADA', label: 'Denegadas', count: counts.denegada, color: 'bg-red-100 text-red-600 border-red-200' },
                        ] as const).map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilterState(f.key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    filterState === f.key
                                        ? `${f.color} shadow-sm ring-1 ring-offset-1 ring-gray-300`
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {f.label}
                                {f.count > 0 && (
                                    <span className="ml-1 opacity-70">({f.count})</span>
                                )}
                            </button>
                        ))}

                        <div className="w-px bg-gray-200 mx-1 self-stretch" />

                        {/* Type Filters */}
                        {([
                            { key: 'TODOS', label: 'Todo', typeFilter: true },
                            { key: 'VACACIONES', label: '🌴', count: counts.vacaciones },
                            { key: 'BAJA', label: '🏥', count: counts.baja },
                            { key: 'PERMISO', label: '📋', count: counts.permiso },
                        ] as const).map(f => (
                            <button
                                key={`type-${f.key}`}
                                onClick={() => setFilterType(f.key)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                    filterType === f.key
                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm'
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                }`}
                                title={f.key === 'TODOS' ? 'Todos los tipos' : f.key}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Pending Alert Banner ─── */}
            {counts.pendiente > 0 && filterState !== 'APROBADA' && filterState !== 'DENEGADA' && (
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                        <span className="font-bold">{counts.pendiente}</span> solicitud{counts.pendiente > 1 ? 'es' : ''} pendiente{counts.pendiente > 1 ? 's' : ''} de aprobación
                    </p>
                    <button
                        onClick={() => setShowPendingFirst(!showPendingFirst)}
                        className="ml-auto text-[10px] text-amber-600 hover:text-amber-800 font-medium flex items-center gap-0.5"
                    >
                        {showPendingFirst ? 'Orden cronológico' : 'Pendientes primero'}
                        {showPendingFirst ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </button>
                </div>
            )}

            {/* ─── Tabla ─── */}
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="font-bold text-gray-600">Empleado</TableHead>
                            <TableHead className="font-bold text-gray-600">Tipo</TableHead>
                            <TableHead className="font-bold text-gray-600">Periodo</TableHead>
                            <TableHead className="font-bold text-gray-600">Estado</TableHead>
                            <TableHead className="font-bold text-gray-600 text-center">Adj.</TableHead>
                            <TableHead className="font-bold text-gray-600 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12">
                                    <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                    <p className="text-gray-500 font-medium">No hay registros</p>
                                    <p className="text-xs text-gray-400 mt-1">Ajusta los filtros para ver más resultados.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredHistory.map(abs => {
                                const typeCfg = TYPE_CONFIG[abs.tipo] || TYPE_CONFIG.OTROS;
                                const statusCfg = STATUS_CONFIG[abs.estado] || STATUS_CONFIG.PENDIENTE;
                                const TypeIcon = typeCfg.icon;
                                const StatusIcon = statusCfg.icon;
                                const dias = differenceInCalendarDays(new Date(abs.fechaFin), new Date(abs.fechaInicio)) + 1;
                                const isPending = abs.estado === 'PENDIENTE';

                                return (
                                    <TableRow
                                        key={abs.id}
                                        className={`hover:bg-gray-50/80 transition-colors ${statusCfg.row} ${
                                            isPending ? 'border-l-4 border-l-amber-400' : ''
                                        }`}
                                    >
                                        <TableCell>
                                            <div className="font-semibold text-gray-900">{abs.empleado.nombre} {abs.empleado.apellidos}</div>
                                            <div className="text-[10px] text-gray-400 uppercase font-medium">{abs.empleado.rol}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${typeCfg.badge}`}>
                                                <TypeIcon className="w-3 h-3" />
                                                {typeCfg.label}
                                                {abs.horas ? <span className="opacity-70">({abs.horas}h)</span> : ''}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-sm text-gray-700">
                                                <span className="font-medium">
                                                    {format(new Date(abs.fechaInicio), 'dd MMM', { locale: es })}
                                                </span>
                                                {abs.fechaInicio !== abs.fechaFin && (
                                                    <>
                                                        <ArrowRight className="w-3 h-3 text-gray-400" />
                                                        <span className="font-medium">
                                                            {format(new Date(abs.fechaFin), 'dd MMM yy', { locale: es })}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                                {dias} día{dias > 1 ? 's' : ''}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusCfg.badge}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusCfg.label}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {abs.justificanteUrl ? (
                                                <a href={abs.justificanteUrl} target="_blank" className="text-blue-600 hover:text-blue-800 inline-flex" title="Ver Justificante">
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="text-gray-200">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1 items-center">
                                                {isPending && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => router.push(`/admin/ausencias?view=CALENDAR&date=${abs.fechaInicio}`)}
                                                            className="h-7 px-2 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                                                            title="Ver en Calendario Global"
                                                        >
                                                            <Calendar className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            disabled={processingId === abs.id}
                                                            onClick={() => handleUpdateStatus(abs.id, 'APROBADA')}
                                                            className="bg-green-600 hover:bg-green-700 text-white h-7 px-2.5 text-xs gap-1"
                                                            title="Aprobar"
                                                        >
                                                            {processingId === abs.id ? '...' : <><CheckCircle className="w-3.5 h-3.5" /> Sí</>}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            disabled={processingId === abs.id}
                                                            onClick={() => handleUpdateStatus(abs.id, 'DENEGADA')}
                                                            className="h-7 px-2.5 text-xs gap-1"
                                                            title="Denegar"
                                                        >
                                                            {processingId === abs.id ? '...' : <><XCircle className="w-3.5 h-3.5" /> No</>}
                                                        </Button>
                                                    </>
                                                )}

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openEditDialog(abs)}
                                                    className="h-7 px-2 text-xs text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-blue-600"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={processingId === abs.id}
                                                    onClick={() => handleDelete(abs.id)}
                                                    className="text-gray-300 hover:text-red-600 h-7 px-1.5"
                                                    title="Eliminar permanentemente"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ─── Edit Dialog ─── */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-blue-500" />
                            Editar Ausencia
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="tipo" className="text-sm font-medium">Tipo</label>
                            <select
                                id="tipo"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editForm.tipo}
                                onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })}
                            >
                                <option value="VACACIONES">Vacaciones</option>
                                <option value="BAJA">Baja Médica</option>
                                <option value="PERMISO">Permiso Retribuido</option>
                                <option value="OTROS">Otros</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label htmlFor="fechaInicio" className="text-sm font-medium">Desde</label>
                                <Input
                                    id="fechaInicio"
                                    type="date"
                                    value={editForm.fechaInicio}
                                    onChange={(e) => setEditForm({ ...editForm, fechaInicio: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="fechaFin" className="text-sm font-medium">Hasta</label>
                                <Input
                                    id="fechaFin"
                                    type="date"
                                    value={editForm.fechaFin}
                                    onChange={(e) => setEditForm({ ...editForm, fechaFin: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="observaciones" className="text-sm font-medium">Observaciones (Opcional)</label>
                            <Textarea
                                id="observaciones"
                                value={editForm.observaciones}
                                onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })}
                                placeholder="Motivo del cambio..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit} disabled={processingId === editingAbsence?.id}>
                            {processingId === editingAbsence?.id ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
