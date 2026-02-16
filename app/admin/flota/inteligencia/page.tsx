'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { Truck, Fuel, Wrench, Wallet, Calendar, ArrowUpRight, ArrowDownRight, Gauge } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import MaintenanceDialog from '@/components/flota/MaintenanceDialog';

export default function FleetIntelligence() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date());
    const [maintenanceOpen, setMaintenanceOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, [month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(month).toISOString();
            const end = endOfMonth(month).toISOString();
            const res = await fetch(`/api/admin/flota/inteligencia?from=${start}&to=${end}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- AGGREGATED METRICS ---
    const totalKm = data.reduce((acc, t) => acc + t.metrics.totalKm, 0);
    const totalFuelCost = data.reduce((acc, t) => acc + t.costs.fuel, 0);
    const totalMaintCost = data.reduce((acc, t) => acc + t.costs.maintenance, 0);
    const totalCost = data.reduce((acc, t) => acc + t.costs.total, 0);
    const avgCostPerKm = totalKm > 0 ? (totalCost / totalKm) : 0;

    // Chart Data Preparation
    const barData = data.map(t => ({
        matricula: t.matricula,
        costPerKm: t.costs.perKm,
        fuel: t.costs.fuel,
        maint: t.costs.maintenance
    })).sort((a, b) => b.costPerKm - a.costPerKm); // Sort by most expensive truck

    const pieData = [
        { name: 'Combustible', value: totalFuelCost },
        { name: 'Mantenimiento', value: totalMaintCost },
        { name: 'Personal (Est)', value: data.reduce((acc, t) => acc + t.costs.driverEstimado, 0) }
    ];
    const COLORS = ['#3b82f6', '#f59e0b', '#10b981'];

    const KPICard = ({ title, value, sub, icon: Icon, color }: any) => (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <h3 className="text-2xl font-bold mt-2">{value}</h3>
                        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                    </div>
                    <div className={`p-3 rounded-lg ${color}`}>
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inteligencia de Flota</h1>
                    <p className="text-gray-500">Análisis de costes, consumo y mantenimiento.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
                        <Button variant="ghost" size="sm" onClick={() => setMonth(subMonths(month, 1))}>←</Button>
                        <span className="font-bold w-32 text-center capitalize">
                            {format(month, 'MMMM yyyy', { locale: es })}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setMonth(subMonths(month, -1))}>→</Button>
                    </div>
                    <Button onClick={() => setMaintenanceOpen(true)} className="bg-gray-900 text-white hover:bg-gray-800 gap-2">
                        <Wrench className="w-4 h-4" /> Registrar Mantenimiento
                    </Button>
                </div>
            </div>

            {/* ERROR / LOADING */}
            {loading && <div className="text-center py-12 text-gray-400">Cargando datos de flota...</div>}

            {!loading && (
                <>
                    {/* KPI GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title="Coste Operativo Total"
                            value={`${totalCost.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €`}
                            sub="Combustible + Mantenimiento + Personal"
                            icon={Wallet}
                            color="bg-gray-900"
                        />
                        <KPICard
                            title="Coste por Kilómetro"
                            value={`${avgCostPerKm.toFixed(3)} €/km`}
                            sub="Media de la flota"
                            icon={Gauge}
                            color={avgCostPerKm > 1.5 ? "bg-red-500" : "bg-blue-600"}
                        />
                        <KPICard
                            title="Gasto en Combustible"
                            value={`${totalFuelCost.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €`}
                            sub={`${data.reduce((acc, t) => acc + t.metrics.consumptionL100, 0) / (data.length || 1)} L/100km (Avg)`}
                            icon={Fuel}
                            color="bg-indigo-500"
                        />
                        <KPICard
                            title="Mantenimiento"
                            value={`${totalMaintCost.toLocaleString('es-ES', { minimumFractionDigits: 0 })} €`}
                            sub="Reparaciones y Revisiones"
                            icon={Wrench}
                            color="bg-orange-500"
                        />
                    </div>

                    {/* CHARTS ROW */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Cost per Truck Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Coste por Kilómetro (Top Vehículos)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" />
                                            <YAxis dataKey="matricula" type="category" width={80} />
                                            <Tooltip formatter={(val: number | undefined) => `${val?.toFixed(3)} €/km`} />
                                            <Legend />
                                            <Bar dataKey="costPerKm" name="Coste €/km" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Breakdown Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Desglose de Costes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-80 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(val: number | undefined) => `${val?.toLocaleString()} €`} />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <p className="text-xs text-gray-400">Total</p>
                                            <p className="text-xl font-bold">{totalCost.toLocaleString()}€</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* DETAILED TABLE */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalle por Vehículo</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b">
                                            <th className="p-4 font-bold text-gray-600">Vehículo</th>
                                            <th className="p-4 font-bold text-gray-600 text-right">KM Recorridos</th>
                                            <th className="p-4 font-bold text-gray-600 text-right">Consumo (L/100)</th>
                                            <th className="p-4 font-bold text-gray-600 text-right text-indigo-600">Combustible</th>
                                            <th className="p-4 font-bold text-gray-600 text-right text-orange-600">Mantenimiento</th>
                                            <th className="p-4 font-bold text-gray-600 text-right text-green-600">Personal</th>
                                            <th className="p-4 font-bold text-gray-600 text-right bg-blue-50 text-blue-800">TOTAL €/KM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barData.map((d: any) => {
                                            const truck = data.find(t => t.matricula === d.matricula);
                                            return (
                                                <tr key={d.matricula} className="border-b last:border-0 hover:bg-gray-50">
                                                    <td className="p-4 font-medium">
                                                        {d.matricula} <span className="text-gray-400 text-xs font-normal">({truck.model})</span>
                                                    </td>
                                                    <td className="p-4 text-right">{truck.metrics.totalKm} km</td>
                                                    <td className="p-4 text-right font-mono">{truck.metrics.consumptionL100} L</td>
                                                    <td className="p-4 text-right">{truck.costs.fuel.toLocaleString()} €</td>
                                                    <td className="p-4 text-right">{truck.costs.maintenance.toLocaleString()} €</td>
                                                    <td className="p-4 text-right">{truck.costs.driverEstimado.toLocaleString()} €</td>
                                                    <td className="p-4 text-right font-black bg-blue-50">{d.costPerKm.toFixed(3)} €</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            <MaintenanceDialog
                open={maintenanceOpen}
                onOpenChange={setMaintenanceOpen}
                onSuccess={fetchData}
            />
        </div>
    );
}
