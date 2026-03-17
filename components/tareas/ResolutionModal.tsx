'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Wrench, AlertTriangle, DollarSign, FileText, Loader2 } from 'lucide-react';

const TIPOS_AVERIA = [
    { value: 'MOTOR', label: 'Motor' },
    { value: 'FRENOS', label: 'Frenos' },
    { value: 'TRANSMISION', label: 'Transmisión' },
    { value: 'ELECTRICO', label: 'Eléctrico' },
    { value: 'NEUMATICOS', label: 'Neumáticos' },
    { value: 'SUSPENSION', label: 'Suspensión' },
    { value: 'DIRECCION', label: 'Dirección' },
    { value: 'CARROCERIA', label: 'Carrocería' },
    { value: 'CISTERNA', label: 'Cisterna' },
    { value: 'HIDRAULICO', label: 'Hidráulico' },
    { value: 'REFRIGERACION', label: 'Refrigeración' },
    { value: 'OTRO', label: 'Otro' },
];

interface ResolutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    loading: boolean;
    taskType: string;
    existingExtension?: any;
}

export default function ResolutionModal({
    isOpen, onClose, onConfirm, loading, taskType, existingExtension
}: ResolutionModalProps) {
    const [resumenCierre, setResumenCierre] = useState('');
    const [diagnosticoFinal, setDiagnosticoFinal] = useState(existingExtension?.diagnosticoFinal || '');
    const [tipoAveria, setTipoAveria] = useState(existingExtension?.tipoAveria || '');
    const [costeFinal, setCosteFinal] = useState(existingExtension?.costeFinal?.toString() || '');
    const [kmReporte, setKmReporte] = useState(existingExtension?.kmReporte?.toString() || '');
    const [proveedorTaller, setProveedorTaller] = useState(existingExtension?.proveedorTaller || '');
    const [piezasCambiadas, setPiezasCambiadas] = useState('');
    const [errors, setErrors] = useState<string[]>([]);

    if (!isOpen) return null;

    const isTaller = taskType === 'TALLER';

    const handleSubmit = () => {
        const validationErrors: string[] = [];

        if (!resumenCierre.trim()) {
            validationErrors.push('El resumen de cierre es obligatorio');
        }

        if (isTaller) {
            if (!diagnosticoFinal.trim()) validationErrors.push('El diagnóstico final es obligatorio');
            if (!tipoAveria) validationErrors.push('El tipo de avería es obligatorio');
            if (costeFinal === '' || costeFinal === null || costeFinal === undefined) {
                validationErrors.push('El coste final es obligatorio (puede ser 0)');
            }
        }

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors([]);

        if (isTaller) {
            onConfirm({
                estado: 'COMPLETADA',
                resumenCierre,
                extensionTaller: {
                    diagnosticoFinal,
                    tipoAveria,
                    costeFinal: parseFloat(costeFinal) || 0,
                    kmReporte: kmReporte ? parseInt(kmReporte) : undefined,
                    proveedorTaller: proveedorTaller || undefined,
                    piezasCambiadas: piezasCambiadas || undefined,
                }
            });
        } else {
            onConfirm({
                estado: 'COMPLETADA',
                resumenCierre,
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center gap-3 pb-2 border-b">
                    <div className={`p-2 rounded-xl ${isTaller ? 'bg-orange-100' : 'bg-green-100'}`}>
                        {isTaller ? <Wrench className="w-5 h-5 text-orange-600" /> : <FileText className="w-5 h-5 text-green-600" />}
                    </div>
                    <h3 className="text-lg font-black text-gray-900">
                        {isTaller ? 'Cerrar Intervención de Taller' : 'Finalizar Tarea'}
                    </h3>
                </div>

                {/* Errores de validación */}
                {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1 animate-in fade-in">
                        <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
                            <AlertTriangle className="w-4 h-4" /> Campos obligatorios
                        </div>
                        {errors.map((e, i) => (
                            <p key={i} className="text-red-700 text-xs pl-6">• {e}</p>
                        ))}
                    </div>
                )}

                {/* Campos TALLER específicos */}
                {isTaller && (
                    <div className="space-y-4 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                        <h4 className="text-xs font-black text-orange-800 uppercase tracking-wider flex items-center gap-2">
                            <Wrench className="w-3.5 h-3.5" /> Datos técnicos de cierre
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-gray-600">
                                    Tipo de Avería <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
                                    value={tipoAveria}
                                    onChange={(e) => setTipoAveria(e.target.value)}
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {TIPOS_AVERIA.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> Coste Final (€) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
                                    value={costeFinal}
                                    onChange={(e) => setCosteFinal(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">Kms al cierre</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 150000"
                                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
                                    value={kmReporte}
                                    onChange={(e) => setKmReporte(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600">Taller / Proveedor</label>
                            <input
                                type="text"
                                placeholder="Interno / Nombre del taller externo"
                                className="w-full p-2 border rounded-lg text-sm"
                                value={proveedorTaller}
                                onChange={(e) => setProveedorTaller(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600">
                                Diagnóstico Final <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                placeholder="¿Cuál fue el problema real? ¿Qué se hizo para reparar?"
                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-400"
                                value={diagnosticoFinal}
                                onChange={(e) => setDiagnosticoFinal(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-600">Piezas cambiadas</label>
                            <input
                                type="text"
                                placeholder="Ej: Filtro aire, correa distribución..."
                                className="w-full p-2 border rounded-lg text-sm"
                                value={piezasCambiadas}
                                onChange={(e) => setPiezasCambiadas(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Resumen de cierre (común) */}
                <div className="space-y-1">
                    <label className="text-sm font-bold text-gray-700">
                        Resumen de cierre <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400"
                        rows={3}
                        placeholder={isTaller
                            ? "Resumen del trabajo realizado, conclusiones finales, observaciones..."
                            : "Explica brevemente la solución aplicada..."
                        }
                        value={resumenCierre}
                        onChange={(e) => setResumenCierre(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-200"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {loading ? 'Cerrando...' : 'Confirmar Cierre'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
