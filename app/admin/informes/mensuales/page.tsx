'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Download, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { downloadExcelWorkbook } from '@/lib/excel';
import MonthlyEmployeeView from '@/components/admin/MonthlyEmployeeView';

// --- MAIN PAGE COMPONENT (The "Hydration Firewall") ---
export default function MonthlyReportPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Server renders this loader. Client hydrates this loader.
    // Then client switches to <MonthlyReportClient />
    if (!mounted) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <p className="text-gray-500 font-medium animate-pulse">Cargando Informe Mensual...</p>
                </div>
            </div>
        );
    }

    return <MonthlyReportClient />;
}

// --- CLIENT LOGIC COMPONENT ---
function MonthlyReportClient() {
    // Safe to use Date() here directly because we are guaranteed to be in the browser
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'GLOBAL' | 'INDIVIDUAL'>('GLOBAL');
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

    // Fetch Global Stats
    useEffect(() => {
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

        if (activeTab === 'GLOBAL') {
            fetchStats();
        }
    }, [year, month, activeTab]);

    // Fetch Employees if needed
    useEffect(() => {
        const fetchEmployees = async () => {
            if (employees.length > 0) return; // Already fetched
            try {
                const res = await fetch('/api/empleados');
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        const activeEmps = data.filter((e: any) => e.activo);
                        setEmployees(activeEmps);
                        if (activeEmps.length > 0 && !selectedEmployeeId) {
                            setSelectedEmployeeId(activeEmps[0].id);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching employees", error);
            }
        };

        if (activeTab === 'INDIVIDUAL') {
            fetchEmployees();
        }
    }, [activeTab]); // Run when switching tabs

    const formatDuration = (hoursDecimal: number) => {
        if (!hoursDecimal) return '0h';
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        return `${h}h ${m}m`;
    };

    const { totals, averages, averagesByRole, ranking, camionRanking } = stats || {};

    const handleExportExcel = () => {
        if (!stats) return;

        // Sheet 1: Empleados
        const empRows = (ranking || []).map((emp: any) => ({
            Empleado: emp.empleado,
            Rol: emp.rol,
            'Días Trabajados': emp.diasTrabajados,
            'Total Horas': Number((emp.horas || 0).toFixed(2)),
            'Media H/Día': Number((emp.mediaHorasDia || 0).toFixed(2)),
            'Total KM': emp.km || 0,
            'Media KM/Día': Math.round(emp.mediaKmDia || 0),
            'Litros Repostados': emp.litros || 0,
            'Consumo (L/100km)': Number((emp.consumoMedio || 0).toFixed(2)),
            Viajes: emp.viajes || 0,
            Descargas: emp.descargas || 0
        }));

        // Sheet 2: Flota Camiones
        const truckRows = (camionRanking || []).map((c: any) => ({
            Matrícula: c.matricula,
            Modelo: c.modelo,
            Salidas: c.salidas,
            'Total KM': c.km,
            'Litros Gasoil': c.litros,
            'Consumo (L/100km)': Number((c.consumoMedio || 0).toFixed(2)),
            Viajes: c.viajes,
            Descargas: c.descargas,
            'Rellenos Aceite': c.aceiteCount,
            'Litros Aceite': c.litrosAceite,
            'Hidráulico': c.hidraulicoCount,
            'Refrigerante': c.refrigeranteCount,
            'Lavados': c.lavadoCount
        }));

        // Sheet 3: KPIs y Roles
        const roleRows = (averagesByRole || []).map((r: any) => ({
            Rol: r.rol,
            'Total Horas': Number((r.totalHoras || 0).toFixed(2)),
            'Media Horas/Día': Number((r.horasPorDia || 0).toFixed(2)),
            'Total KM': r.totalKm || 0,
            'Media KM/Día': Math.round(r.kmPorDia || 0),
            'Consumo Medio (L/100km)': Number((r.consumoMedio || 0).toFixed(2))
        }));

        downloadExcelWorkbook(`Informe_Mensual_SEL_${year}_${String(month).padStart(2, '0')}.xlsx`, [
            { name: 'Empleados', rows: empRows },
            { name: 'Flota_Camiones', rows: truckRows },
            { name: 'Roles_KPIs', rows: roleRows }
        ]);
    };

    const handleSelectEmployeeFromGlobal = (empId: number) => {
        if (!empId) return;
        setSelectedEmployeeId(empId);
        setActiveTab('INDIVIDUAL');
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            {/* TOP CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl border shadow-sm gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Informe Mensual</h1>
                    <p className="text-gray-500 text-sm">Análisis de productividad y costes operativos.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        disabled={!stats}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar Excel (.xlsx)
                    </button>
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="p-2 border rounded-lg font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM', { locale: es }).toUpperCase()}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="p-2 border rounded-lg font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TABS */}
            <div className="flex gap-1 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('GLOBAL')}
                    className={`pb-3 px-6 font-bold text-sm transition-all border-b-2 ${activeTab === 'GLOBAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                >
                    VISIÓN GLOBAL
                </button>
                <button
                    onClick={() => setActiveTab('INDIVIDUAL')}
                    className={`pb-3 px-6 font-bold text-sm transition-all border-b-2 ${activeTab === 'INDIVIDUAL' ? 'border-blue-600 text-blue-600 ' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                >
                    DETALLE INDIVIDUAL
                </button>
            </div>

            {/* --- GLOBAL VIEW --- */}
            {activeTab === 'GLOBAL' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <>
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
                            <div className="flex justify-between items-end border-b pb-2 mt-8">
                                <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest">Desglose por Empleado</h2>
                                <span className="text-xs text-blue-600 font-semibold">Haz clic en un empleado para abrir su Detalle Individual y Nómina</span>
                            </div>
                            <Card>
                                <CardContent className="p-0 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="p-4 font-bold text-gray-600">Empleado</th>
                                                <th className="p-4 font-bold text-gray-600 text-center hidden md:table-cell">Días Trab.</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Total Horas</th>
                                                <th className="p-4 font-bold text-gray-600 text-center hidden md:table-cell">Media H/Día</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Total KM</th>
                                                <th className="p-4 font-bold text-gray-600 text-center hidden md:table-cell">Media KM/Día</th>
                                                <th className="p-4 font-bold text-gray-600 text-center hidden md:table-cell">Consumo</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Viajes</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Descargas</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ranking?.map((emp: any, idx: number) => (
                                                <tr
                                                    key={idx}
                                                    onClick={() => handleSelectEmployeeFromGlobal(emp.empleadoId)}
                                                    className="border-b last:border-0 hover:bg-blue-50/60 cursor-pointer transition-colors"
                                                >
                                                    <td className="p-4">
                                                        <p className="font-bold text-blue-900 hover:underline">{emp.empleado}</p>
                                                        <p className="text-[10px] uppercase font-bold text-gray-400">{emp.rol}</p>
                                                    </td>
                                                    <td className="p-4 text-center hidden md:table-cell">{emp.diasTrabajados}</td>
                                                    <td className="p-4 text-center font-bold text-blue-700">{formatDuration(emp.horas)}</td>
                                                    <td className="p-4 text-center text-gray-500 hidden md:table-cell">{(emp.mediaHorasDia || 0).toFixed(1)} h</td>
                                                    <td className="p-4 text-center font-mono">{emp.km}</td>
                                                    <td className="p-4 text-center text-gray-500 hidden md:table-cell">{Math.round(emp.mediaKmDia || 0)}</td>
                                                    <td className="p-4 text-center font-bold text-purple-700 hidden md:table-cell">{(emp.consumoMedio || 0).toFixed(1)} L/100</td>
                                                    <td className="p-4 text-center">{emp.viajes}</td>
                                                    <td className="p-4 text-center">{emp.descargas}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>

                            {/* TRUCK PERFORMANCE & CONSUMPTION RANKING */}
                            {camionRanking && camionRanking.length > 0 && (
                                <>
                                    <h2 className="text-lg font-black text-gray-800 uppercase tracking-widest border-b pb-2 mt-8 flex items-center gap-2">
                                        <Truck className="w-5 h-5 text-indigo-600" />
                                        Rendimiento, Consumo y Mantenimiento por Camión
                                    </h2>
                                    <Card>
                                        <CardContent className="p-0 overflow-x-auto">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-indigo-50/60 border-b">
                                                    <tr>
                                                        <th className="p-4 font-bold text-indigo-950">Matrícula / Vehículo</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Salidas</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Total KM</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Repostado (L)</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Consumo Medio</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Viajes</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Descargas</th>
                                                        <th className="p-4 font-bold text-indigo-950 text-center">Mantenimiento Conductor</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {camionRanking.map((c: any) => (
                                                        <tr key={c.camionId} className="border-b last:border-0 hover:bg-gray-50">
                                                            <td className="p-4">
                                                                <p className="font-black text-indigo-900 font-mono">{c.matricula}</p>
                                                                <p className="text-[11px] text-gray-400">{c.modelo}</p>
                                                            </td>
                                                            <td className="p-4 text-center font-semibold">{c.salidas}</td>
                                                            <td className="p-4 text-center font-mono font-bold">{(c.km || 0).toLocaleString()} km</td>
                                                            <td className="p-4 text-center font-mono">{(c.litros || 0).toLocaleString()} L</td>
                                                            <td className="p-4 text-center">
                                                                <span className={`px-2 py-1 rounded font-bold text-xs ${
                                                                    c.consumoMedio > 45 ? 'bg-red-100 text-red-700' :
                                                                    c.consumoMedio > 0 ? 'bg-purple-100 text-purple-800' : 'text-gray-400'
                                                                }`}>
                                                                    {c.consumoMedio > 0 ? `${c.consumoMedio.toFixed(1)} L/100km` : '—'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center">{c.viajes}</td>
                                                            <td className="p-4 text-center">{c.descargas}</td>
                                                            <td className="p-4 text-center">
                                                                <div className="flex flex-wrap justify-center gap-1 text-[11px]">
                                                                    {c.aceiteCount > 0 && (
                                                                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                                                                            🛢️ Aceite ({c.aceiteCount}{c.litrosAceite > 0 ? ` · ${c.litrosAceite}L` : ''})
                                                                        </span>
                                                                    )}
                                                                    {c.hidraulicoCount > 0 && (
                                                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                                                                            ⚙️ Hidr. ({c.hidraulicoCount})
                                                                        </span>
                                                                    )}
                                                                    {c.refrigeranteCount > 0 && (
                                                                        <span className="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-bold">
                                                                            🌡️ Refr. ({c.refrigeranteCount})
                                                                        </span>
                                                                    )}
                                                                    {c.lavadoCount > 0 && (
                                                                        <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                                                            🚿 Lavado ({c.lavadoCount})
                                                                        </span>
                                                                    )}
                                                                    {c.aceiteCount === 0 && c.hidraulicoCount === 0 && c.refrigeranteCount === 0 && c.lavadoCount === 0 && (
                                                                        <span className="text-gray-300">—</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* --- INDIVIDUAL VIEW --- */}
            {activeTab === 'INDIVIDUAL' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                    {/* SELECTOR */}
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col md:flex-row items-center gap-4">
                        <span className="text-sm font-bold text-blue-800 uppercase whitespace-nowrap">Seleccionar Empleado:</span>
                        <select
                            value={selectedEmployeeId || ''}
                            onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                            className="p-2 rounded-lg border border-blue-200 font-bold text-gray-700 w-full md:w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellidos}</option>
                            ))}
                        </select>
                    </div>

                    {selectedEmployeeId ? (
                        <MonthlyEmployeeView
                            key={`${selectedEmployeeId}-${year}-${month}`}
                            employeeId={selectedEmployeeId}
                            year={year}
                            month={month}
                        />
                    ) : (
                        <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            Seleciona un empleado para ver su informe detallado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
