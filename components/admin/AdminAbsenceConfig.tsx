'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { Settings, Save, Lock, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AbsenceConfig {
    habilitarAutoAprobacion: boolean;
    autoAprobarDias: number;
    diasAntelacion: number;
}

interface BlockedPeriod {
    id: number;
    fechaInicio: string;
    fechaFin: string;
    motivo: string;
}

interface AdminAbsenceConfigProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function AdminAbsenceConfig({ open, onOpenChange }: AdminAbsenceConfigProps) {
    const [config, setConfig] = useState<AbsenceConfig>({
        habilitarAutoAprobacion: false,
        autoAprobarDias: 1,
        diasAntelacion: 7
    });
    const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // New Block State
    const [newBlock, setNewBlock] = useState({ start: '', end: '', reason: '' });

    useEffect(() => {
        if (open) {
            fetchAll();
        }
    }, [open]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [configRes, blocksRes] = await Promise.all([
                fetch('/api/admin/ausencias/config'),
                fetch('/api/admin/ausencias/bloqueos')
            ]);

            if (configRes.ok) {
                const data = await configRes.json();
                setConfig(data);
            }
            if (blocksRes.ok) {
                const blocks = await blocksRes.json();
                setBlockedPeriods(Array.isArray(blocks) ? blocks : []);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar configuración");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/ausencias/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                toast.success("Configuración guardada");
            } else {
                toast.error("Error al guardar");
            }
        } catch (error) {
            toast.error("Error de red");
        } finally {
            setSaving(false);
        }
    };

    const handleAddBlock = async () => {
        if (!newBlock.start || !newBlock.end || !newBlock.reason) {
            toast.error("Todos los campos son obligatorios");
            return;
        }
        try {
            const res = await fetch('/api/admin/ausencias/bloqueos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fechaInicio: newBlock.start,
                    fechaFin: newBlock.end,
                    motivo: newBlock.reason
                })
            });

            if (res.ok) {
                toast.success("Periodo bloqueado añadido");
                setNewBlock({ start: '', end: '', reason: '' });
                fetchAll(); // Refresh list
            } else {
                toast.error("Error al crear bloqueo");
            }
        } catch (error) {
            toast.error("Error de conexión");
        }
    };

    const handleDeleteBlock = async (id: number) => {
        if (!confirm("¿Eliminar este bloqueo?")) return;
        try {
            const res = await fetch(`/api/admin/ausencias/bloqueos?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast.success("Bloqueo eliminado");
                setBlockedPeriods(prev => prev.filter(b => b.id !== id));
            } else {
                toast.error("Error al eliminar");
            }
        } catch (error) {
            toast.error("Error de conexión");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-600" />
                        Configuración Avanzada de Ausencias
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona reglas automáticas y restricciones de calendario (Fase 4).
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-gray-400">Cargando...</div>
                ) : (
                    <div className="space-y-8 py-4">
                        {/* SECTION 1: AUTO-APPROVAL */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b pb-2">Reglas de Auto-aprobación</h4>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                <div>
                                    <h5 className="font-medium text-gray-900">Habilitar Auto-aprobación</h5>
                                    <p className="text-xs text-gray-500">Para solicitudes cortas y con antelación.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.habilitarAutoAprobacion}
                                        onChange={e => setConfig({ ...config, habilitarAutoAprobacion: e.target.checked })}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-700">Duración máx. (días)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={config.autoAprobarDias}
                                        onChange={e => setConfig({ ...config, autoAprobarDias: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-700">Antelación mín. (días)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={config.diasAntelacion}
                                        onChange={e => setConfig({ ...config, diasAntelacion: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Guardar Reglas'}
                                </Button>
                            </div>
                        </div>

                        {/* SECTION 2: BLOCKED PERIODS (PHASE 4) */}
                        <div className="space-y-4">
                            <h4 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                                <Lock className="w-4 h-4" /> Periodos Bloqueados
                            </h4>
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-3">
                                <h5 className="text-sm font-bold text-red-800">Añadir Nuevo Bloqueo</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="date"
                                        className="p-2 border rounded text-sm"
                                        value={newBlock.start}
                                        onChange={e => setNewBlock({ ...newBlock, start: e.target.value })}
                                        placeholder="Inicio"
                                    />
                                    <input
                                        type="date"
                                        className="p-2 border rounded text-sm"
                                        value={newBlock.end}
                                        onChange={e => setNewBlock({ ...newBlock, end: e.target.value })}
                                        placeholder="Fin"
                                    />
                                    <input
                                        type="text"
                                        className="p-2 border rounded text-sm"
                                        value={newBlock.reason}
                                        onChange={e => setNewBlock({ ...newBlock, reason: e.target.value })}
                                        placeholder="Motivo (ej: Inventario)"
                                    />
                                </div>
                                <Button size="sm" variant="danger" onClick={handleAddBlock} className="w-full md:w-auto">
                                    <Lock className="w-3 h-3 mr-2" /> Bloquear Periodo
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-600">Periodos Activos</h5>
                                {blockedPeriods.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No hay periodos bloqueados.</p>
                                ) : (
                                    <div className="grid gap-2">
                                        {blockedPeriods.map(block => (
                                            <div key={block.id} className="flex justify-between items-center p-2 bg-white border rounded shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-red-100 p-2 rounded text-red-600">
                                                        <Calendar className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-800">{block.motivo}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {format(new Date(block.fechaInicio), 'd MMM yyyy', { locale: es })} - {format(new Date(block.fechaFin), 'd MMM yyyy', { locale: es })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button size="icon" variant="ghost" onClick={() => handleDeleteBlock(block.id)} className="text-red-500 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="sm:justify-between">
                    <p className="text-xs text-gray-400 mt-2 sm:mt-0">
                        Los cambios en bloqueos son inmediatos.
                    </p>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
