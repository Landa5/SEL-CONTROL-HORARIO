'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Sparkles, AlertTriangle, CheckCircle, ArrowRight, Truck, TrendingDown, Gauge, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PredictiveMaintenanceWidget() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const router = useRouter();

    const fetchData = () => {
        fetch('/api/ai/predictive')
            .then(res => res.json())
            .then(d => {
                console.log('Predictive Data Received:', d);
                if (Array.isArray(d)) setData(d.sort((a, b) => a.healthScore - b.healthScore));
                setLoading(false);
            })
            .catch(err => {
                console.error('Predictive Fetch Error:', err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleProcessInvoices = async () => {
        setProcessing(true);
        try {
            const res = await fetch('/api/admin/process-invoices', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                if (result.count > 0) {
                    alert(`${result.message}`);
                    fetchData();
                } else if (result.details && result.details.length > 0) {
                    const firstError = result.details.find((d: any) => d.status === 'error');
                    alert(`Detectados ${result.details.length} archivos, pero ninguno se pudo integrar.\nMotivo ejemplo: ${firstError?.message || 'Datos no reconocidos'}`);
                } else {
                    alert(result.message);
                }
            } else {
                alert(`Error: ${result.error || result.message}`);
            }
        } catch (error) {
            alert('Error de conexión al procesar facturas.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-100 rounded-xl"></div>
        </div>
    );

    return (
        <section className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        Análisis Predictivo IA
                        <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded-full lowercase font-normal">beta</span>
                    </h2>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleProcessInvoices}
                        disabled={processing}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all flex items-center gap-1.5 flex-1 sm:flex-none justify-center ${processing
                            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100 hover:border-purple-200 shadow-sm'
                            }`}
                    >
                        <FileText className={`w-3 h-3 ${processing ? 'animate-spin' : ''}`} />
                        {processing ? 'Procesando...' : 'Sincronizar'}
                    </button>
                    <button
                        onClick={async () => {
                            if (!confirm('¿Quieres re-procesar las facturas fallidas? Se borrarán sus datos actuales (0 KM, etc.) y se volverán a enviar a la IA.')) return;
                            setProcessing(true);
                            try {
                                const res = await fetch('/api/admin/reset-fallbacks', { method: 'POST' });
                                const json = await res.json();
                                alert(json.message);
                                if (json.success) handleProcessInvoices(); // Auto-sync after reset
                            } catch (e) { alert('Error al reiniciar'); }
                            setProcessing(false);
                        }}
                        disabled={processing}
                        className="text-[10px] font-bold px-3 py-1 rounded-full border border-orange-100 bg-orange-50 text-orange-600 hover:bg-orange-100 transition-all flex-1 sm:flex-none justify-center"
                    >
                        Reforzar IA
                    </button>
                    <button
                        onClick={async () => {
                            if (!confirm('¿Eliminar facturas duplicadas? Se mantendrá la más reciente y se borrarán las copias idénticas.')) return;
                            setProcessing(true);
                            try {
                                const res = await fetch('/api/admin/deduplicate', { method: 'POST' });
                                const json = await res.json();
                                alert(json.message);
                                fetchData(); // Refresh data
                            } catch (e) { alert('Error al limpiar'); }
                            setProcessing(false);
                        }}
                        disabled={processing}
                        className="text-[10px] font-bold px-3 py-1 rounded-full border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition-all flex-1 sm:flex-none justify-center"
                    >
                        Limpiar Duplicados
                    </button>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="bg-emerald-50/50 border-2 border-dashed border-emerald-100 p-6 rounded-3xl flex flex-col items-center justify-center text-center gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-bold text-emerald-800">Flota en Estado Óptimo</p>
                    <p className="text-[10px] text-emerald-600 uppercase tracking-tighter">La IA no ha detectado patrones de riesgo ni mantenimientos próximos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {data.slice(0, 3).map((item) => (
                        <Card key={item.id} className="overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-gray-50/50 group hover:shadow-lg transition-all border-l-4"
                            style={{ borderLeftColor: item.healthScore < 60 ? '#ef4444' : '#8b5cf6' }}>
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${item.healthScore < 60 ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                                                <Truck className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-black text-gray-900 leading-none">{item.matricula}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight mt-1">{item.model || 'Remolque/Cisterna'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            {item.alerts.map((alert: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 text-[11px] font-medium text-gray-600 bg-white/60 p-2 rounded-lg border border-gray-100/50">
                                                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${item.healthScore < 60 ? 'text-red-500' : 'text-purple-500'}`} />
                                                    {alert}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="text-right space-y-2">
                                        <div className="flex flex-col items-end">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Score Salud</p>
                                            <div className="relative w-16 h-16 flex items-center justify-center">
                                                <svg className="w-full h-full -rotate-90">
                                                    <circle cx="32" cy="32" r="28" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                                                    <circle cx="32" cy="32" r="28" fill="none"
                                                        stroke={item.healthScore < 60 ? '#ef4444' : '#8b5cf6'}
                                                        strokeWidth="6"
                                                        strokeDasharray={175}
                                                        strokeDashoffset={175 - (175 * item.healthScore) / 100}
                                                        className="transition-all duration-1000"
                                                    />
                                                </svg>
                                                <span className="absolute text-sm font-black text-gray-900">{item.healthScore}%</span>
                                            </div>
                                        </div>
                                        <div className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase ${item.status === 'CRÍTICO' ? 'bg-red-600 text-white' : 'bg-purple-600 text-white'}`}>
                                            <TrendingDown className="w-3 h-3" /> {item.status}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {data.length > 3 && (
                <button className="text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors flex items-center gap-1 mx-auto mt-2">
                    Ver más análisis de flota <ArrowRight className="w-3 h-3" />
                </button>
            )}
        </section>
    );
}
