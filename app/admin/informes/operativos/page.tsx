'use client';

import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import {
    Truck,
    Fuel,
    TrendingUp,
    Euro,
    Calendar,
    Download,
    Filter,
    Search
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function OperationalReportsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        to: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(dateRange);
            const res = await fetch(`/api/admin/informes/flota?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleMonthChange = (offset: number) => {
        const current = new Date(dateRange.from);
        const newDate = subMonths(current, offset * -1); // offset negative for back
        setDateRange({
            from: format(startOfMonth(newDate), 'yyyy-MM-dd'),
            to: format(endOfMonth(newDate), 'yyyy-MM-dd')
        });
    };

    if (loading && !data) return <div className="p-12 text-center text-gray-500 animate-pulse">Cargando informes...</div>;

    const { summary, data: truckList } = data || { summary: {}, data: [] };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">

            {/* HEADER & FILTERS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Informe de Flota y Consumo</h1>
                    <p className="text-gray-500 text-sm">Análisis detallado de eficiencia, kilometraje y costes operativos.</p>
                </div>

                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border">
                    <Button variant="ghost" size="sm" onClick={() => handleMonthChange(-1)}>Anterior</Button>
                    <div className="px-4 font-bold text-gray-700 w-32 text-center capitalize">
                        {format(new Date(dateRange.from), 'MMMM yyyy', { locale: es })}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleMonthChange(1)}>Siguiente</Button>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Kilometraje Total"
                    value={summary.totalKm?.toLocaleString()}
                    unit="km"
                    icon={Truck}
                    color="blue"
                />
                <KpiCard
                    label="Combustible Total"
                    value={summary.totalLitros?.toLocaleString()}
                    unit="L"
                    icon={Fuel}
                    color="orange"
                />
                <KpiCard
                    label="Consumo Medio"
                    value={summary.consumoMedio}
                    unit="L/100km"
                    icon={TrendingUp}
                    color={summary.consumoMedio > 35 ? "red" : "emerald"}
                />
                <KpiCard
                    label="Coste Est. Combustible"
                    value={summary.totalCoste?.toLocaleString()}
                    unit="€"
                    icon={Euro}
                    color="slate"
                />
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Consumption Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase text-gray-500">Consumo por Vehículo (L/100km)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={truckList.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 'auto']} hide />
                                <YAxis dataKey="matricula" type="category" width={80} style={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: any) => [`${val} L/100km`, 'Consumo']}
                                />
                                <Bar dataKey="consumoMedio" fill="#f97316" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Mileage Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase text-gray-500">Kilometraje por Vehículo</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={truckList.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="matricula" type="category" width={80} style={{ fontSize: '12px', fontWeight: 'bold' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(val: any) => [`${val} km`, 'Distancia']}
                                />
                                <Bar dataKey="kmTotales" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* DETAILED TABLE */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Detalle por Vehículo</CardTitle>
                    <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-y text-gray-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-3">Matrícula</th>
                                    <th className="px-6 py-3">Modelo</th>
                                    <th className="px-6 py-3 text-right">KM Totales</th>
                                    <th className="px-6 py-3 text-right">Litros</th>
                                    <th className="px-6 py-3 text-right">Consumo (L/100)</th>
                                    <th className="px-6 py-3 text-right">Viajes</th>
                                    <th className="px-6 py-3 text-right">Coste Est.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {truckList.map((truck: any) => (
                                    <tr key={truck.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-900">{truck.matricula}</td>
                                        <td className="px-6 py-4 text-gray-600">{truck.modelo || '-'}</td>
                                        <td className="px-6 py-4 text-right font-mono">{truck.kmTotales.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right font-mono">{truck.litrosTotales.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold px-2 py-1 rounded text-xs ${truck.consumoMedio > 35 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {truck.consumoMedio} L/100
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">{truck.viajes}</td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-600">{truck.costeCombustible.toLocaleString()} €</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function KpiCard({ label, value, unit, icon: Icon, color }: any) {
    const colorClasses: any = {
        blue: 'text-blue-600 bg-blue-50',
        orange: 'text-orange-600 bg-orange-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        red: 'text-red-600 bg-red-50',
        slate: 'text-slate-600 bg-slate-50'
    };

    return (
        <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-gray-900">{value}</span>
                    <span className="text-sm font-medium text-gray-500">{unit}</span>
                </div>
            </div>
            <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}
