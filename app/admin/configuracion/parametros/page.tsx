
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Save, Truck, Users, Settings2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function BusinessConfigPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<any>({
        // Default fallbacks in case fetch fails initially
        consumoObjetivoL100Km: 30,
        costePorKm: 1.2,
        alertaMantenimientoKm: 50000,
        cortesiaPuntualidadMin: 5,
        limiteHorasExtraMensual: 20,
        costeHoraExtraReferencia: 15,
        tiempoObjetivoCargaDescargaMin: 45
    });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/configuracion/parametros');
            if (res.ok) {
                const data = await res.json();
                if (data && !data.error) {
                    setConfig(data);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar la configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/configuracion/parametros', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                toast.success('Parámetros actualizados correctamente');
                // Refresh to ensure we have the latest server state (id, timestamps)
                fetchConfig();
            } else {
                toast.error('Error al guardar');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        // Simple numeric input handling
        setConfig((prev: any) => ({
            ...prev,
            [key]: value
        }));
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;
    }

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500 container mx-auto p-4 md:p-8">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-blue-600" />
                        Parámetros del Negocio
                    </h1>
                    <p className="text-gray-500 mt-1">Configura las variables globales para cálculos y alertas de productividad.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. FLOTA */}
                <Card className="bg-white border-blue-100 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                        <CardTitle className="text-lg font-bold text-blue-800 uppercase flex items-center gap-2">
                            <Truck className="w-5 h-5" /> Flota y Consumos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Consumo Objetivo (L/100km)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.consumoObjetivoL100Km}
                                    onChange={(e) => handleChange('consumoObjetivoL100Km', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">L/100km</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Referencia para alertas de exceso</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Coste Estimado por KM</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={config.costePorKm}
                                    onChange={(e) => handleChange('costePorKm', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">€/km</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Para cálculos de rentabilidad de ruta</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Alerta Mantenimiento</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.alertaMantenimientoKm}
                                    onChange={(e) => handleChange('alertaMantenimientoKm', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">KM</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Intervalo cíclico para revisiones</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. PERSONAL */}
                <Card className="bg-white border-purple-100 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
                        <CardTitle className="text-lg font-bold text-purple-800 uppercase flex items-center gap-2">
                            <Users className="w-5 h-5" /> Personal y Horarios
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Cortesía Puntualidad</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.cortesiaPuntualidadMin}
                                    onChange={(e) => handleChange('cortesiaPuntualidadMin', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">min</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Margen antes de marcar "Retraso"</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Límite Horas Extra Mensual</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.limiteHorasExtraMensual}
                                    onChange={(e) => handleChange('limiteHorasExtraMensual', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">horas</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Alerta si se supera este acumulado</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Coste Hora Extra (Ref.)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={config.costeHoraExtraReferencia}
                                    onChange={(e) => handleChange('costeHoraExtraReferencia', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">€/h</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Para estimación de costes de personal</p>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. OPERATIVA */}
                <Card className="bg-white border-orange-100 shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader className="bg-orange-50/50 border-b border-orange-100 pb-4">
                        <CardTitle className="text-lg font-bold text-orange-800 uppercase flex items-center gap-2">
                            <Settings2 className="w-5 h-5" /> Operativa Logística
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Objetivo Carga/Descarga</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={config.tiempoObjetivoCargaDescargaMin}
                                    onChange={(e) => handleChange('tiempoObjetivoCargaDescargaMin', e.target.value)}
                                    className="w-full p-3 border rounded-lg font-mono text-lg focus:ring-2 focus:ring-orange-500 outline-none"
                                />
                                <span className="absolute right-4 top-3.5 text-gray-400 font-bold text-sm">min</span>
                            </div>
                            <p className="text-[10px] text-gray-400 flex items-center gap-1"><Info className="w-3 h-3" /> Tiempo estándar esperado por operación</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
