'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { Settings, Save } from 'lucide-react';

interface AbsenceConfig {
    habilitarAutoAprobacion: boolean;
    autoAprobarDias: number;
    diasAntelacion: number;
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchConfig();
        }
    }, [open]);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/ausencias/config');
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            } else {
                toast.error("Error al cargar la configuración");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de red");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/ausencias/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                toast.success("Configuración guardada correctamente");
                onOpenChange(false);
            } else {
                toast.error("Error al guardar la configuración");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de red");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-600" />
                        Configuración de Ausencias
                    </DialogTitle>
                    <DialogDescription>
                        Define las reglas automáticas para la gestión de vacaciones y permisos.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-8 text-center text-gray-400">Cargando...</div>
                ) : (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <h4 className="font-semibold text-gray-900">Auto-aprobación</h4>
                                <p className="text-sm text-gray-500">Aprobar automáticamente solicitudes pequeñas.</p>
                            </div>
                            <div className="flex items-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.habilitarAutoAprobacion}
                                        onChange={e => setConfig({ ...config, habilitarAutoAprobacion: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className={`space-y-4 transition-all ${config.habilitarAutoAprobacion ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Duración máxima (días)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    className="w-full p-2 border rounded-md"
                                    value={config.autoAprobarDias}
                                    onChange={e => setConfig({ ...config, autoAprobarDias: Number(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500">
                                    Si la solicitud dura igual o menos que esto, se aprobará.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Antelación mínima (días)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full p-2 border rounded-md"
                                    value={config.diasAntelacion}
                                    onChange={e => setConfig({ ...config, diasAntelacion: Number(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500">
                                    Debe solicitarse con al menos estos días de antelación.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading || saving} className="bg-blue-600 text-white hover:bg-blue-700">
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
