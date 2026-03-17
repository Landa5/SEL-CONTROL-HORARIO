'use client';

import { useState, useEffect } from 'react';
import { Wrench, Truck, AlertTriangle, DollarSign, Clock, RefreshCw, TrendingDown, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#e11d48', '#84cc16'];

const TIPO_LABELS: Record<string, string> = {
    MOTOR: 'Motor', FRENOS: 'Frenos', TRANSMISION: 'Transmisión', ELECTRICO: 'Eléctrico',
    NEUMATICOS: 'Neumáticos', SUSPENSION: 'Suspensión', DIRECCION: 'Dirección',
    CARROCERIA: 'Carrocería', CISTERNA: 'Cisterna', HIDRAULICO: 'Hidráulico',
    REFRIGERACION: 'Refrigeración', OTRO: 'Otro',
};

export default function TallerDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState(30);

    useEffect(() => {
        fetchStats();
    }, [periodo]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/taller/estadisticas?periodo=${periodo}`);
            if (res.ok) setStats(await res.json());
        } catch (e) {
            console.error('Error loading stats:', e);
        } finally {
            setLoading(false);
        }
    };

    const formatHours = (hours: number) => {
        if (!hours) return '—';
        if (hours < 24) return `${Math.round(hours)}h`;
        const days = Math.floor(hours / 24);
        const remaining = Math.round(hours % 24);
        return `${days}d ${remaining}h`;
    };

    if (loading || !stats) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    const pieData = stats.porTipo?.map((item: any) => ({
        name: TIPO_LABELS[item.tipo] || item.tipo || 'Sin tipo',
        value: item.count,
    })) || [];

    const barData = stats.porCamion?.map((item: any) => ({
        name: item.camion?.matricula || `#${item.camionId}`,
        averias: item.count,
        modelo: item.camion?.modelo || '',
    })) || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-orange-100 rounded-xl">
                        <Wrench className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Taller — Panel Analítico</h2>
                        <p className="text-sm text-gray-500">Últimos {periodo} días</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-0.5 border">
                        {[7, 30, 90].map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriodo(p)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    periodo === p
                                        ? 'bg-white shadow text-orange-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {p}d
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchStats}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                    icon={AlertTriangle}
                    label="Averías Activas"
                    value={stats.averiasActivas}
                    color="orange"
                    emphasis={stats.averiasActivas > 5}
                />
                <KPICard
                    icon={Truck}
                    label="Vehículos Inmov."
                    value={stats.vehiculosInmovilizados}
                    color="red"
                    emphasis={stats.vehiculosInmovilizados > 0}
                />
                <KPICard
                    icon={DollarSign}
                    label="Coste Total"
                    value={`${(stats.costeTotal || 0).toFixed(0)}€`}
                    color="blue"
                />
                <KPICard
                    icon={TrendingDown}
                    label="Coste Medio"
                    value={`${(stats.costeMedio || 0).toFixed(0)}€`}
                    color="purple"
                />
                <KPICard
                    icon={Clock}
                    label="Tiempo Medio"
                    value={formatHours(stats.tiempoMedioResolucionHoras)}
                    color="green"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Pie - Averías por Tipo */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border">
                    <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                        <BarChart3 className="w-4 h-4 text-orange-500" /> Averías por Tipo
                    </h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    innerRadius={50}
                                    dataKey="value"
                                    label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {pieData.map((_: any, index: number) => (
                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`${value} averías`, '']}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                            Sin datos de tipo para este período
                        </div>
                    )}
                </div>

                {/* Bar - Averías por Camión */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border">
                    <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                        <Truck className="w-4 h-4 text-blue-500" /> Top Camiones con Averías
                    </h3>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis type="number" allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fontWeight: 700 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
                                    formatter={(value: any, _: any, props: any) => [
                                        `${value} averías`,
                                        props.payload.modelo || ''
                                    ]}
                                />
                                <Bar dataKey="averias" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
                            Sin datos de camiones para este período
                        </div>
                    )}
                </div>

            </div>

            {/* Summary Footer */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between text-sm text-gray-500 border">
                <span>
                    {stats.totalCerradas} intervenciones cerradas en los últimos {periodo} días
                </span>
                <span className="text-xs text-gray-400">
                    Datos actualizados al cargar
                </span>
            </div>
        </div>
    );
}

// KPI Card Component
function KPICard({ icon: Icon, label, value, color, emphasis }: {
    icon: any; label: string; value: string | number; color: string; emphasis?: boolean;
}) {
    const colorMap: Record<string, { bg: string; text: string; iconBg: string; valueBg: string }> = {
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', iconBg: 'bg-orange-100', valueBg: 'text-orange-900' },
        red: { bg: 'bg-red-50', text: 'text-red-600', iconBg: 'bg-red-100', valueBg: 'text-red-900' },
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100', valueBg: 'text-blue-900' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100', valueBg: 'text-purple-900' },
        green: { bg: 'bg-green-50', text: 'text-green-600', iconBg: 'bg-green-100', valueBg: 'text-green-900' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className={`${c.bg} p-4 rounded-2xl border transition-all hover:shadow-md ${emphasis ? 'ring-2 ring-offset-2 ring-red-300 animate-pulse' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 ${c.iconBg} rounded-lg`}>
                    <Icon className={`w-4 h-4 ${c.text}`} />
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-2xl font-black ${c.valueBg}`}>{value}</p>
        </div>
    );
}
