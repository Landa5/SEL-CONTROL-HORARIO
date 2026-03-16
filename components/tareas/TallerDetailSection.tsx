'use client';

import { useState } from 'react';
import { Wrench, DollarSign, AlertTriangle, Truck, Clock, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const TIPOS_AVERIA_LABELS: Record<string, string> = {
    MOTOR: 'Motor', FRENOS: 'Frenos', TRANSMISION: 'Transmisión', ELECTRICO: 'Eléctrico',
    NEUMATICOS: 'Neumáticos', SUSPENSION: 'Suspensión', DIRECCION: 'Dirección',
    CARROCERIA: 'Carrocería', CISTERNA: 'Cisterna', HIDRAULICO: 'Hidráulico',
    REFRIGERACION: 'Refrigeración', OTRO: 'Otro',
};

interface TallerDetailSectionProps {
    extension: any;
    taskId: number;
    canEdit: boolean;
    onUpdate: () => void;
}

export default function TallerDetailSection({ extension, taskId, canEdit, onUpdate }: TallerDetailSectionProps) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        tipoAveria: extension?.tipoAveria || '',
        kmReporte: extension?.kmReporte?.toString() || '',
        costeEstimado: extension?.costeEstimado?.toString() || '',
        vehiculoInmovilizado: extension?.vehiculoInmovilizado || false,
        puedeCircular: extension?.puedeCircular !== false,
        requiereGrua: extension?.requiereGrua || false,
        diagnosticoInicial: extension?.diagnosticoInicial || '',
        detalleAveria: extension?.detalleAveria || '',
        proveedorTaller: extension?.proveedorTaller || '',
    });

    if (!extension) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/tareas/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extensionTaller: {
                        ...form,
                        kmReporte: form.kmReporte ? parseInt(form.kmReporte) : null,
                        costeEstimado: form.costeEstimado ? parseFloat(form.costeEstimado) : null,
                    }
                })
            });
            if (res.ok) {
                setEditing(false);
                onUpdate();
            }
        } catch (e) {
            console.error('Error saving taller extension:', e);
        } finally {
            setSaving(false);
        }
    };

    // Vista readonly
    if (!editing) {
        return (
            <div className="bg-orange-50/80 p-4 rounded-xl border border-orange-200 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-orange-800 uppercase tracking-wider flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5" /> Datos de Taller
                    </h4>
                    {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="text-orange-600 hover:bg-orange-100 text-xs h-7">
                            Editar
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    {extension.tipoAveria && (
                        <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase">Tipo Avería</p>
                            <p className="font-bold text-orange-900">{TIPOS_AVERIA_LABELS[extension.tipoAveria] || extension.tipoAveria}</p>
                        </div>
                    )}
                    {extension.kmReporte != null && (
                        <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase">Km al reporte</p>
                            <p className="font-bold text-orange-900">{extension.kmReporte.toLocaleString()} km</p>
                        </div>
                    )}
                    {extension.costeEstimado != null && (
                        <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase">Coste estimado</p>
                            <p className="font-bold text-orange-900">{extension.costeEstimado.toFixed(2)} €</p>
                        </div>
                    )}
                    {extension.costeFinal != null && (
                        <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase">Coste final</p>
                            <p className="font-black text-orange-900 text-lg">{extension.costeFinal.toFixed(2)} €</p>
                        </div>
                    )}
                    {extension.proveedorTaller && (
                        <div>
                            <p className="text-[10px] font-bold text-orange-400 uppercase">Taller</p>
                            <p className="font-bold text-orange-900">{extension.proveedorTaller}</p>
                        </div>
                    )}
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-2">
                    {extension.vehiculoInmovilizado && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> INMOVILIZADO
                        </span>
                    )}
                    {extension.requiereGrua && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full flex items-center gap-1">
                            <Truck className="w-3 h-3" /> REQUIERE GRÚA
                        </span>
                    )}
                    {!extension.puedeCircular && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">NO PUEDE CIRCULAR</span>
                    )}
                    {extension.piezaPendiente && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> PIEZA PENDIENTE
                        </span>
                    )}
                </div>

                {/* Diagnósticos */}
                {extension.diagnosticoInicial && (
                    <div className="pt-2 border-t border-orange-200">
                        <p className="text-[10px] font-bold text-orange-400 uppercase">Diagnóstico inicial</p>
                        <p className="text-sm text-orange-900 whitespace-pre-wrap">{extension.diagnosticoInicial}</p>
                    </div>
                )}
                {extension.diagnosticoFinal && (
                    <div className="pt-2 border-t border-orange-200">
                        <p className="text-[10px] font-bold text-orange-400 uppercase">Diagnóstico final</p>
                        <p className="text-sm text-orange-900 font-semibold whitespace-pre-wrap">{extension.diagnosticoFinal}</p>
                    </div>
                )}
            </div>
        );
    }

    // Vista edición
    return (
        <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-300 space-y-3 animate-in fade-in">
            <h4 className="text-xs font-black text-orange-800 uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" /> Editar Datos de Taller
            </h4>

            <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-600">Tipo de Avería</label>
                    <select
                        className="w-full p-2 border rounded-lg text-sm"
                        value={form.tipoAveria}
                        onChange={e => setForm({ ...form, tipoAveria: e.target.value })}
                    >
                        <option value="">-- Seleccionar --</option>
                        {Object.entries(TIPOS_AVERIA_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Km al reporte</label>
                    <input type="number" className="w-full p-2 border rounded-lg text-sm" value={form.kmReporte}
                        onChange={e => setForm({ ...form, kmReporte: e.target.value })} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-600">Coste estimado (€)</label>
                    <input type="number" step="0.01" className="w-full p-2 border rounded-lg text-sm" value={form.costeEstimado}
                        onChange={e => setForm({ ...form, costeEstimado: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold text-gray-600">Taller / Proveedor</label>
                    <input type="text" placeholder="Interno" className="w-full p-2 border rounded-lg text-sm" value={form.proveedorTaller}
                        onChange={e => setForm({ ...form, proveedorTaller: e.target.value })} />
                </div>
            </div>

            <div className="flex flex-wrap gap-4 bg-white p-3 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.vehiculoInmovilizado}
                        onChange={e => setForm({ ...form, vehiculoInmovilizado: e.target.checked })}
                        className="w-4 h-4 text-red-600 rounded" />
                    <span className="font-semibold">Vehículo inmovilizado</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.requiereGrua}
                        onChange={e => setForm({ ...form, requiereGrua: e.target.checked })}
                        className="w-4 h-4 text-yellow-600 rounded" />
                    <span className="font-semibold">Requiere grúa</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.puedeCircular}
                        onChange={e => setForm({ ...form, puedeCircular: e.target.checked })}
                        className="w-4 h-4 text-green-600 rounded" />
                    <span className="font-semibold">Puede circular</span>
                </label>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-gray-600">Diagnóstico inicial</label>
                <textarea rows={2} className="w-full p-2 border rounded-lg text-sm" value={form.diagnosticoInicial}
                    onChange={e => setForm({ ...form, diagnosticoInicial: e.target.value })} />
            </div>

            <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                    Guardar
                </Button>
            </div>
        </div>
    );
}
