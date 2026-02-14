'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "sonner";
import { format } from 'date-fns';

interface AbsenceFormProps {
    onSuccess: () => void;
    employeeId?: number; // Optional: If provided, admin is creating for this employee
    defaultDate?: Date;
    onCancel?: () => void;
}

export default function AbsenceForm({ onSuccess, employeeId, defaultDate, onCancel }: AbsenceFormProps) {
    const [activeTab, setActiveTab] = useState<'VACACIONES' | 'BAJA'>('VACACIONES');
    const [loading, setLoading] = useState(false);

    // Form States
    const [fechaInicio, setFechaInicio] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : "");
    const [fechaFin, setFechaFin] = useState(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : "");
    const [observaciones, setObservaciones] = useState("");
    const [file, setFile] = useState<File | null>(null);

    // Calculation State
    const [excludeNonWorking, setExcludeNonWorking] = useState(false);
    const [calculatedDays, setCalculatedDays] = useState<{ total: number, working: number, details: string[] } | null>(null);

    // Hourly State
    const [isHourly, setIsHourly] = useState(false);
    const [hours, setHours] = useState<string>("");

    useEffect(() => {
        if (isHourly && fechaInicio) {
            setFechaFin(fechaInicio); // Force same day
        }
    }, [isHourly, fechaInicio]);

    useEffect(() => {
        if (fechaInicio && fechaFin && !isHourly) {
            calculateDays();
        } else {
            setCalculatedDays(null);
        }
    }, [fechaInicio, fechaFin, excludeNonWorking, isHourly]);

    async function calculateDays() {
        try {
            const res = await fetch('/api/ausencias/calc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: fechaInicio, endDate: fechaFin, excludeNonWorking })
            });
            if (res.ok) {
                const data = await res.json();
                setCalculatedDays({
                    total: data.days,
                    working: data.workingDays,
                    details: data.details
                });
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validation for BAJA
        if (activeTab === 'BAJA' && !file) {
            toast.error("Es obligatorio adjuntar un justificante para bajas médicas.");
            return;
        }

        // Validation for Hours
        if (isHourly && (!hours || parseFloat(hours) <= 0)) {
            toast.error("Indica la cantidad de horas.");
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('tipo', activeTab);
            formData.append('fechaInicio', fechaInicio);
            if (isHourly) {
                formData.append('fechaFin', fechaInicio); // Same day
                formData.append('horas', hours);
            } else {
                if (fechaFin) formData.append('fechaFin', fechaFin);
            }

            if (observaciones) formData.append('observaciones', observaciones);
            if (file) formData.append('justificante', file);
            if (employeeId) formData.append('empleadoId', employeeId.toString());

            const res = await fetch('/api/ausencias', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                toast.success("Solicitud creada correctamente");
                // Reset form
                setFechaInicio("");
                setFechaFin("");
                setObservaciones("");
                setFile(null);
                setCalculatedDays(null);
                setHours("");
                setIsHourly(false);
                onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || "Error al enviar solicitud");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 mb-4">
                <button
                    type="button"
                    className={`px-4 py-2 font-bold w-full sm:w-auto rounded transition-colors ${activeTab === 'VACACIONES' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => setActiveTab('VACACIONES')}
                >
                    Solicitar Vacaciones
                </button>
                <button
                    type="button"
                    className={`px-4 py-2 font-bold w-full sm:w-auto rounded transition-colors ${activeTab === 'BAJA' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    onClick={() => setActiveTab('BAJA')}
                >
                    Notificar Baja / Ausencia
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isHourly}
                            onChange={e => setIsHourly(e.target.checked)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Solicitud por Horas (Parcial)</span>
                    </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Fecha {isHourly ? '(Día)' : 'Inicio'}</label>
                        <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} required />
                    </div>
                    {isHourly ? (
                        <div>
                            <label className="block text-sm font-medium mb-1">Horas</label>
                            <Input
                                type="number"
                                value={hours}
                                onChange={e => setHours(e.target.value)}
                                placeholder="Ej: 2.5"
                                min="0.5"
                                step="0.5"
                                required
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium mb-1">Fecha Fin</label>
                            <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} required />
                        </div>
                    )}
                </div>

                {/* Working Days Calculation Preview */}
                {!isHourly && calculatedDays && (
                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700">Resumen de Días:</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={excludeNonWorking}
                                    onChange={e => setExcludeNonWorking(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-gray-600 text-xs">Descontar festivos/findes</span>
                            </label>
                        </div>
                        <div className="flex gap-4">
                            <div>
                                <span className="block text-gray-500 text-xs">Días Naturales</span>
                                <span className="font-mono font-bold text-lg">{calculatedDays.total}</span>
                            </div>
                            <div className={`${excludeNonWorking ? 'text-green-600' : 'text-gray-900'}`}>
                                <span className="block text-xs opacity-80">Días a Descontar</span>
                                <span className="font-mono font-bold text-lg">{calculatedDays.working}</span>
                            </div>
                        </div>
                        {excludeNonWorking && calculatedDays.details.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500 border-t border-blue-100 pt-1">
                                <strong>No computan:</strong> {calculatedDays.details.length} días (festivos/findes).
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'VACACIONES' ? (
                    <div>
                        <label className="block text-sm font-medium mb-1">Observaciones (Opcional)</label>
                        <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Motivo o comentarios..." />
                    </div>
                ) : (
                    <div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">Observaciones / Motivo</label>
                            <Input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Explica el motivo..." />
                        </div>
                        <div className="bg-orange-50 p-3 rounded border border-orange-100">
                            <label className="block text-sm font-bold text-orange-800 mb-1">
                                Justificante Médico (Obligatorio) <span className="text-red-500">*</span>
                            </label>
                            <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,image/*" className="bg-white" />
                            <p className="text-xs text-orange-600 mt-1">Es necesario adjuntar el parte de baja o justificante.</p>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                            Cancelar
                        </Button>
                    )}
                    <Button type="submit" disabled={loading} className={`${activeTab === 'BAJA' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {loading ? 'Enviando...' : (activeTab === 'VACACIONES' ? 'Solicitar Vacaciones' : 'Registrar Baja')}
                    </Button>
                </div>
            </form>
        </div>
    );
}
