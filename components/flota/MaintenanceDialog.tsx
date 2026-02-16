'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Truck, Wrench, Calendar, DollarSign, Gauge } from 'lucide-react';
import { toast } from 'sonner';

interface MaintenanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export default function MaintenanceDialog({ open, onOpenChange, onSuccess }: MaintenanceDialogProps) {
    const [trucks, setTrucks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        camionId: '',
        tipo: 'ACEITE_MOTOR',
        descripcion: '',
        costo: '',
        kmActual: '',
        taller: '',
        proximoKm: ''
    });

    useEffect(() => {
        if (open) {
            fetchTrucks();
        }
    }, [open]);

    const fetchTrucks = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/camiones');
            if (res.ok) {
                const data = await res.json();
                setTrucks(data.filter((t: any) => t.activo));
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar camiones');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/admin/flota/mantenimiento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) throw new Error('Error al guardar');

            toast.success('Mantenimiento registrado correctamente');
            onSuccess();
            onOpenChange(false);
            setFormData({
                camionId: '',
                tipo: 'ACEITE_MOTOR',
                descripcion: '',
                costo: '',
                kmActual: '',
                taller: '',
                proximoKm: ''
            });
        } catch (error) {
            toast.error('Error al registrar mantenimiento');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-blue-400" />
                        Registrar Mantenimiento
                    </h2>
                    <button onClick={() => onOpenChange(false)} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Truck Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Camión</label>
                        <select
                            required
                            className="w-full border rounded-lg p-2 bg-gray-50 focus:ring-2 focus:ring-blue-500"
                            value={formData.camionId}
                            onChange={e => {
                                const t = trucks.find(tr => tr.id === parseInt(e.target.value));
                                setFormData({ ...formData, camionId: e.target.value, kmActual: t ? t.kmActual : '' });
                            }}
                        >
                            <option value="">Seleccionar Camión...</option>
                            {trucks.map(t => (
                                <option key={t.id} value={t.id}>{t.matricula} - {t.modelo}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                                className="w-full border rounded-lg p-2"
                                value={formData.tipo}
                                onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                            >
                                <option value="ACEITE_MOTOR">Aceite Motor</option>
                                <option value="RUEDAS">Ruedas</option>
                                <option value="FRENOS">Frenos</option>
                                <option value="ITV">ITV</option>
                                <option value="TACÓGRAFO">Tacógrafo</option>
                                <option value="FILTROS">Filtros</option>
                                <option value="CORREA">Correa Distribución</option>
                                <option value="EMBRAGUE">Embrague</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>

                        {/* Cost */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo (€)</label>
                            <div className="relative">
                                <DollarSign className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    className="w-full border rounded-lg p-2 pl-9"
                                    placeholder="0.00"
                                    value={formData.costo}
                                    onChange={e => setFormData({ ...formData, costo: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* KM Actual */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">KM Actuales</label>
                            <div className="relative">
                                <Gauge className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                                <input
                                    type="number"
                                    required
                                    className="w-full border rounded-lg p-2 pl-9"
                                    value={formData.kmActual}
                                    onChange={e => setFormData({ ...formData, kmActual: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Next KM */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Próximo KM (Opcional)</label>
                            <input
                                type="number"
                                className="w-full border rounded-lg p-2"
                                placeholder="Ej: +30k"
                                value={formData.proximoKm}
                                onChange={e => setFormData({ ...formData, proximoKm: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Workshop & Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Taller</label>
                        <input
                            type="text"
                            className="w-full border rounded-lg p-2"
                            placeholder="Nombre del taller (o 'Propio')"
                            value={formData.taller}
                            onChange={e => setFormData({ ...formData, taller: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Notas</label>
                        <textarea
                            className="w-full border rounded-lg p-2 h-20"
                            placeholder="Detalles del trabajo realizado..."
                            value={formData.descripcion}
                            onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {submitting ? 'Guardando...' : 'Registrar Mantenimiento'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
