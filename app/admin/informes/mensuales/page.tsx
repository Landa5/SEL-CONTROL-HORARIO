'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MonthlyEmployeeView from '@/components/admin/MonthlyEmployeeView';

export default function MonthlyReportPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    // New State for Individual View
    const [activeTab, setActiveTab] = useState<'GLOBAL' | 'INDIVIDUAL'>('GLOBAL');
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/mensuales?year=${year}&month=${month}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch report", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [year, month]);

    const formatDuration = (hoursDecimal: number) => {
        if (!hoursDecimal) return '0h';
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        return `${h}h ${m}m`;
    };

    if (loading && !stats) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const { totals, averages, averagesByRole, ranking } = stats || {};

    const fetchEmployees = async () => {
        try {
            // Reuse existing endpoint that lists employees
            const res = await fetch('/api/empleados');
            if (res.ok) {
                const data = await res.json();
                setEmployees(data.filter((e: any) => e.activo));
                if (data.length > 0 && !selectedEmployeeId) {
                    setSelectedEmployeeId(data[0].id);
                }
            }
        } catch (error) { console.error("Error fetching employees", error); }
    };

    useEffect(() => {
        if (activeTab === 'INDIVIDUAL' && employees.length === 0) {
            fetchEmployees();
        }
    }, [activeTab]);

    return (
        <div className="space-y-8 pb-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Informe Mensual</h1>
                    <p className="text-gray-500 text-sm">Análisis de productividad y costes operativos.</p>
                </div>
                <div className="flex gap-4">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="p-2 border rounded font-bold"
                    >
                        <option value={0}>AÑO COMPLETO</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM', { locale: es }).toUpperCase()}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="p-2 border rounded font-bold"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="flex gap-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('GLOBAL')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === 'GLOBAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    VISIÓN GLOBAL
                </button>
                <button
                    onClick={() => setActiveTab('INDIVIDUAL')}
                    className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === 'INDIVIDUAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    DETALLE INDIVIDUAL
                </button>
            </div>

            {/* EMPLOYEE SELECTOR */}
            {activeTab === 'INDIVIDUAL' && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 mb-6">
                    <span className="text-sm font-bold text-blue-800 uppercase">Seleccionar Empleado:</span>
                    <select
                        value={selectedEmployeeId || ''}
                        onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                        className="p-2 rounded border border-blue-200 font-bold text-gray-700 w-64"
                    >
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* INDIVIDUAL VIEW */}
            {activeTab === 'INDIVIDUAL' && month === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r shadow-sm animate-in fade-in">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Por favor, <strong>selecciona un mes específico</strong> para ver el detalle individual del empleado.
                                <br />La vista anual no está disponible en modo detalle.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'INDIVIDUAL' && selectedEmployeeId && month !== 0 && (
                <MonthlyEmployeeView
                    employeeId={selectedEmployeeId}
                    year={year}
                    month={month}
                />
            )}

            {activeTab === 'GLOBAL' && (
                <div className="space-y-8 animate-in fade-in">
                    {/* TOTALS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-blue-50 border-blue-100">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-blue-600 uppercase">Total Horas</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-blue-900">{formatDuration(totals?.totalHoras || 0)}</div>
                                <p className="text-xs text-blue-400 mt-1">{totals?.countJornadas} jornadas registradas</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-indigo-50 border-indigo-100">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-indigo-600 uppercase">Kilómetros</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-indigo-900">{(totals?.totalKm || 0).toLocaleString()} km</div>
                                <p className="text-xs text-indigo-400 mt-1">Total flota</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-purple-50 border-purple-100">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-purple-600 uppercase">Combustible</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-purple-900">{(totals?.totalLitros || 0).toLocaleString()} L</div>
                                <p className="text-xs text-purple-400 mt-1">Repostado en total</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50 border-green-100">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-green-600 uppercase">Operativa</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-green-900">{totals?.totalViajes || 0} <span className="text-lg text-green-600">viajes</span></div>
                                <p className="text-xs text-green-500 mt-1">{totals?.totalDescargas || 0} descargas</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AVERAGES SECTION */}
                    <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest border-b pb-2">Medias y Ratios (KPIs)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Media Horas / Día</p>
                            <p className="text-2xl font-black text-gray-900">{(averages?.horasPorJornada || 0).toFixed(1)} h</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Media KM / Día</p>
                            <p className="text-2xl font-black text-gray-900">{Math.round(averages?.kmPorJornada || 0)} km</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Media KM / Salida</p>
                            <p className="text-2xl font-black text-gray-900">{Math.round(averages?.kmPorSalida || 0)} km</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Consumo Medio</p>
                            <p className="text-2xl font-black text-gray-900">{(averages?.consumoMedio || 0).toFixed(1)} <span className="text-sm text-gray-500">L/100km</span></p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border shadow-sm text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Viajes / Día</p>
                            <p className="text-2xl font-black text-gray-900">{(averages?.viajesPorDia || 0).toFixed(1)}</p>
                        </div>
                    </div>

                    {/* ROLE AVERAGES */}
                    <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest border-b pb-2 mt-8">Productividad por Puesto/Rol</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {averagesByRole?.map((roleStat: any, idx: number) => (
                            <Card key={idx} className="bg-slate-50 border-slate-200">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold text-slate-600 uppercase flex justify-between">
                                        {roleStat.rol}
                                        <span className="text-slate-400 text-xs">{Math.round(roleStat.totalHoras)}h totales</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase">Horas / Día</p>
                                            <p className="text-xl font-black text-slate-800">{(roleStat.horasPorDia || 0).toFixed(1)} h</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase">KM / Día</p>
                                            <p className="text-xl font-black text-slate-800">{Math.round(roleStat.kmPorDia || 0)} km</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* EMPLOYEE RANKING */}
                    <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest border-b pb-2 mt-8">Desglose por Empleado</h2>
                    <Card>
                        <CardContent className="p-0 overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-4 font-bold text-gray-600">Empleado</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Días Trab.</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Total Horas</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Media Horas/Día</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Total KM</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Media KM/Día</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Consumo (L/100)</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Viajes</th>
                                        <th className="p-4 font-bold text-gray-600 text-center">Descargas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ranking?.map((emp: any, idx: number) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-4">
                                                <p className="font-bold text-gray-900">{emp.empleado}</p>
                                                <p className="text-[10px] uppercase font-bold text-gray-400">{emp.rol}</p>
                                            </td>
                                            <td className="p-4 text-center">{emp.diasTrabajados}</td>
                                            <td className="p-4 text-center font-bold text-blue-700">{formatDuration(emp.horas)}</td>
                                            <td className="p-4 text-center text-gray-500">{(emp.mediaHorasDia || 0).toFixed(1)} h</td>
                                            <td className="p-4 text-center font-mono">{emp.km}</td>
                                            <td className="p-4 text-center text-gray-500">{Math.round(emp.mediaKmDia || 0)}</td>
                                            <td className="p-4 text-center font-bold text-purple-700">{(emp.consumoMedio || 0).toFixed(1)} L</td>
                                            <td className="p-4 text-center">{emp.viajes}</td>
                                            <td className="p-4 text-center">{emp.descargas}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
