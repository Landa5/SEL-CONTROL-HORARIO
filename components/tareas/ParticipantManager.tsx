'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, X, Eye, Wrench, Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const ROL_ICONS: Record<string, any> = {
    RESPONSABLE: Crown,
    SEGUIDOR: Eye,
    COLABORADOR: Wrench,
    OBSERVADOR: Eye,
};

const ROL_COLORS: Record<string, string> = {
    RESPONSABLE: 'text-amber-700 bg-amber-100',
    SEGUIDOR: 'text-blue-700 bg-blue-100',
    COLABORADOR: 'text-green-700 bg-green-100',
    OBSERVADOR: 'text-gray-600 bg-gray-100',
};

const ROL_LABELS: Record<string, string> = {
    RESPONSABLE: 'Responsable',
    SEGUIDOR: 'Seguidor',
    COLABORADOR: 'Colaborador',
    OBSERVADOR: 'Observador',
};

interface ParticipantManagerProps {
    taskId: number;
    canEdit: boolean;
}

export default function ParticipantManager({ taskId, canEdit }: ParticipantManagerProps) {
    const [participantes, setParticipantes] = useState<any[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [selectedRol, setSelectedRol] = useState('SEGUIDOR');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchParticipantes();
    }, [taskId]);

    const fetchParticipantes = async () => {
        try {
            const res = await fetch(`/api/tareas/${taskId}/participantes`);
            if (res.ok) setParticipantes(await res.json());
        } catch (e) {
            console.error('Error loading participants:', e);
        }
    };

    const fetchEmployees = async () => {
        if (employees.length > 0) return;
        try {
            const res = await fetch('/api/empleados');
            if (res.ok) setEmployees(await res.json());
        } catch (e) {
            console.error('Error loading employees:', e);
        }
    };

    const handleAdd = async () => {
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/tareas/${taskId}/participantes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    empleadoId: Number(selectedEmployee),
                    rolParticipacion: selectedRol,
                })
            });
            if (res.ok) {
                fetchParticipantes();
                setSelectedEmployee('');
                setShowAdd(false);
            }
        } catch (e) {
            console.error('Error adding participant:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (empleadoId: number) => {
        try {
            await fetch(`/api/tareas/${taskId}/participantes?empleadoId=${empleadoId}`, {
                method: 'DELETE',
            });
            fetchParticipantes();
        } catch (e) {
            console.error('Error removing participant:', e);
        }
    };

    const existingIds = participantes.map((p: any) => p.empleadoId);
    const availableEmployees = employees.filter(e => !existingIds.includes(e.id));

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-gray-400 uppercase flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Participantes ({participantes.length})
                </h4>
                {canEdit && (
                    <Button
                        variant="ghost" size="sm"
                        onClick={() => { setShowAdd(!showAdd); fetchEmployees(); }}
                        className="text-blue-600 hover:bg-blue-50 text-xs h-7"
                    >
                        <UserPlus className="w-3.5 h-3.5 mr-1" /> Añadir
                    </Button>
                )}
            </div>

            {/* Lista de participantes */}
            <div className="space-y-1.5">
                {participantes.map((p: any) => {
                    const RolIcon = ROL_ICONS[p.rolParticipacion] || Eye;
                    const colors = ROL_COLORS[p.rolParticipacion] || 'text-gray-600 bg-gray-100';

                    return (
                        <div key={p.empleadoId} className="flex items-center justify-between group hover:bg-gray-50 rounded-lg p-1.5 transition-colors">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${colors}`}>
                                    {p.empleado?.nombre?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-800 leading-tight">
                                        {p.empleado?.nombre}
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <RolIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                                            {ROL_LABELS[p.rolParticipacion] || p.rolParticipacion}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {canEdit && p.rolParticipacion !== 'RESPONSABLE' && (
                                <button
                                    onClick={() => handleRemove(p.empleadoId)}
                                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    );
                })}

                {participantes.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-2">Sin participantes asignados</p>
                )}
            </div>

            {/* Formulario añadir */}
            {showAdd && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2 animate-in fade-in slide-in-from-top-2">
                    <select
                        className="w-full p-2 text-sm border rounded-lg"
                        value={selectedEmployee}
                        onChange={e => setSelectedEmployee(e.target.value)}
                    >
                        <option value="">-- Seleccionar empleado --</option>
                        {availableEmployees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.nombre} {emp.apellidos} ({emp.rol})
                            </option>
                        ))}
                    </select>

                    <div className="flex gap-2">
                        <select
                            className="flex-1 p-2 text-sm border rounded-lg"
                            value={selectedRol}
                            onChange={e => setSelectedRol(e.target.value)}
                        >
                            <option value="SEGUIDOR">Seguidor</option>
                            <option value="COLABORADOR">Colaborador</option>
                            <option value="OBSERVADOR">Observador</option>
                        </select>

                        <Button
                            size="sm" onClick={handleAdd} disabled={saving || !selectedEmployee}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Añadir'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
