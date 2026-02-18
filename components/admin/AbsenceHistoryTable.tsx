import React, { useState } from 'react';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/Table";
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, CheckCircle, XCircle, Trash2, Calendar } from 'lucide-react';
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
export default function AbsenceHistoryTable({ history }: AbsenceHistoryTableProps) {
    const router = useRouter();
    const [filterType, setFilterType] = useState<string>('TODOS');
    const [filterState, setFilterState] = useState<string>('TODOS');
    const [processingId, setProcessingId] = useState<number | null>(null);

    // Edit State
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        fechaInicio: '',
        fechaFin: '',
        tipo: 'VACACIONES',
        observaciones: ''
    });

    const filteredHistory = history.filter(abs => {
        if (filterType !== 'TODOS' && abs.tipo !== filterType) return false;
        if (filterState !== 'TODOS' && abs.estado !== filterState) return false;
        return true;
    });

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
            observaciones: '' // We don't have this in the interface yet, strictly speaking, but okay
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

    const getStatusColor = (estado: string) => {
        switch (estado) {
            case 'APROBADA': return 'bg-green-100 text-green-700';
            case 'DENEGADA': return 'bg-red-100 text-red-700';
            case 'PENDIENTE': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getTypeColor = (tipo: string) => {
        switch (tipo) {
            case 'VACACIONES': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'BAJA': return 'bg-orange-50 text-orange-700 border-orange-100';
            case 'PERMISO': return 'bg-purple-50 text-purple-700 border-purple-100';
            default: return 'bg-gray-50 text-gray-700 border-gray-100';
        }
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-700">Historial y Solicitudes</h3>
                <div className="flex gap-2">
                    <select
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="TODOS">Todos los Tipos</option>
                        <option value="VACACIONES">Vacaciones</option>
                        <option value="BAJA">Bajas</option>
                        <option value="PERMISO">Permisos</option>
                    </select>
                    <select
                        className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        value={filterState}
                        onChange={(e) => setFilterState(e.target.value)}
                    >
                        <option value="TODOS">Todos los Estados</option>
                        <option value="PENDIENTE">Pendientes</option>
                        <option value="APROBADA">Aprobadas</option>
                        <option value="DENEGADA">Denegadas</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empleado</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Fechas</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Adjunto</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredHistory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    No hay registros que coincidan con los filtros.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredHistory.map(abs => (
                                <TableRow key={abs.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <div className="font-medium text-gray-900">{abs.empleado.nombre} {abs.empleado.apellidos}</div>
                                        <div className="text-xs text-gray-500 uppercase">{abs.empleado.rol}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs font-bold border ${getTypeColor(abs.tipo)} uppercase`}>
                                            {abs.tipo} {abs.horas ? `(${abs.horas}h)` : ''}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm text-gray-700">
                                            {format(new Date(abs.fechaInicio), 'dd MMM', { locale: es })}
                                            {abs.fechaInicio !== abs.fechaFin && (
                                                <> - {format(new Date(abs.fechaFin), 'dd MMM yyyy', { locale: es })}</>
                                            )}
                                            <span className="ml-2 text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                                ({differenceInCalendarDays(new Date(abs.fechaFin), new Date(abs.fechaInicio)) + 1} días)
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(abs.estado)}`}>
                                            {abs.estado}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {abs.justificanteUrl ? (
                                            <a href={abs.justificanteUrl} target="_blank" className="text-blue-600 hover:text-blue-800" title="Ver Justificante">
                                                <FileText className="w-4 h-4" />
                                            </a>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1 items-center">
                                            {abs.estado === 'PENDIENTE' && (
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
                                                        className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs"
                                                        title="Aprobar"
                                                    >
                                                        {processingId === abs.id ? '...' : <CheckCircle className="w-4 h-4" />}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="danger"
                                                        disabled={processingId === abs.id}
                                                        onClick={() => handleUpdateStatus(abs.id, 'DENEGADA')}
                                                        className="h-7 px-2 text-xs"
                                                        title="Denegar"
                                                    >
                                                        {processingId === abs.id ? '...' : <XCircle className="w-4 h-4" />}
                                                    </Button>
                                                </>
                                            )}

                                            {/* Edit Button - Available for all or based on policy. Let's allow for all for now or PENDING/APPROVED */}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(abs)}
                                                className="h-7 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 ml-1"
                                                title="Editar"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={processingId === abs.id}
                                                onClick={() => handleDelete(abs.id)}
                                                className="text-gray-400 hover:text-red-600 h-7 px-2"
                                                title="Eliminar permanentemente"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Ausencia</DialogTitle>
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
