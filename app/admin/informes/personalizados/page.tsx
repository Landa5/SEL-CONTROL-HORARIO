'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, FileDown, Filter, Calendar, Users, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CustomReportsPage() {
    // State for Filters
    const [startDate, setStartDate] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
    const [selectedRole, setSelectedRole] = useState('TODOS');

    // State for Metrics (Columns)
    const [metrics, setMetrics] = useState({
        hours: true,
        overtime: true,
        km: true,
        fuel: true,
        punctuality: true,
        days: true
    });

    // State for Data
    const [reportData, setReportData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);

    // Roles (Hardcoded for now, could be fetched)
    const roles = ['TODOS', 'CONDUCTOR', 'OFICINA', 'TALLER', 'MECANICO'];

    const handleGenerate = async () => {
        setLoading(true);
        setGenerated(false);
        try {
            const res = await fetch('/api/admin/informes/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    role: selectedRole,
                    metrics // backend receives this but currently returns all, frontend filters view
                })
            });

            if (res.ok) {
                const data = await res.json();
                setReportData(data);
                setGenerated(true);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (!reportData.length) return;

        // Headers
        const headers = ['Empleado', 'Rol'];
        if (metrics.days) headers.push('Días Trab.');
        if (metrics.hours) headers.push('Total Horas');
        if (metrics.overtime) headers.push('Horas Extra');
        if (metrics.km) headers.push('Total KM');
        if (metrics.fuel) headers.push('Litros');
        if (metrics.punctuality) headers.push('Puntualidad Media');

        // Rows
        const rows = reportData.map(row => {
            const r = [row.nombre + ' ' + row.apellidos, row.rol];
            if (metrics.days) r.push(row.diasTrabajados);
            if (metrics.hours) r.push(row.totalHoras.toString().replace('.', ','));
            if (metrics.overtime) r.push(row.totalExtras.toString().replace('.', ','));
            if (metrics.km) r.push(row.totalKm);
            if (metrics.fuel) r.push(row.totalLitros);
            if (metrics.punctuality) r.push(row.puntualidadMedia + ' min');
            return r.join(';');
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(';') + "\n"
            + rows.join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `informe_personalizado_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500 container mx-auto p-4 md:p-8">
            {/* HERDER */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                        <Filter className="w-8 h-8 text-blue-600" />
                        Informes Personalizados
                    </h1>
                    <p className="text-gray-500 mt-1">Genera reportes a medida filtrando por fecha, rol y métricas.</p>
                </div>
            </div>

            {/* CONFIGURATION CARD */}
            <Card className="bg-white border-blue-100 shadow-sm">
                <CardHeader className="bg-blue-50/50 border-b border-blue-100 pb-4">
                    <CardTitle className="text-sm font-bold text-blue-800 uppercase flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Configuración del Informe
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Time Range */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase">Rango de Fechas</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Desde</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Hasta</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full p-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                            <Users className="w-3 h-3" /> Filtrar por Rol
                        </label>
                        <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                            className="w-full p-2 border rounded font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                            <BarChart3 className="w-3 h-3" /> Métricas a Incluir
                        </label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.days} onChange={e => setMetrics({ ...metrics, days: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Días Trab.</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.hours} onChange={e => setMetrics({ ...metrics, hours: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Total Horas</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.overtime} onChange={e => setMetrics({ ...metrics, overtime: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Horas Extra</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.km} onChange={e => setMetrics({ ...metrics, km: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Kilómetros</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.fuel} onChange={e => setMetrics({ ...metrics, fuel: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Combustible</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={metrics.punctuality} onChange={e => setMetrics({ ...metrics, punctuality: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span>Puntualidad</span>
                            </label>
                        </div>
                    </div>
                </CardContent>
                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                        {loading ? 'Generando...' : 'Generar Informe'}
                    </button>
                </div>
            </Card>

            {/* RESULTS */}
            {generated && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-black text-gray-800 uppercase">Resultados ({reportData.length})</h2>
                        <button
                            onClick={handleExportCSV}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 font-bold py-2 px-4 rounded border border-green-200 transition-all flex items-center gap-2 text-sm"
                        >
                            <FileDown className="w-4 h-4" /> Exportar CSV
                        </button>
                    </div>

                    <Card className="overflow-hidden border-0 shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="p-4 uppercase font-bold tracking-wider">Empleado</th>
                                        <th className="p-4 uppercase font-bold tracking-wider">Rol</th>
                                        {metrics.days && <th className="p-4 uppercase font-bold tracking-wider text-center">Días</th>}
                                        {metrics.hours && <th className="p-4 uppercase font-bold tracking-wider text-center">Horas</th>}
                                        {metrics.overtime && <th className="p-4 uppercase font-bold tracking-wider text-center bg-gray-700">Extras</th>}
                                        {metrics.km && <th className="p-4 uppercase font-bold tracking-wider text-center">KM</th>}
                                        {metrics.fuel && <th className="p-4 uppercase font-bold tracking-wider text-center">Litros</th>}
                                        {metrics.punctuality && <th className="p-4 uppercase font-bold tracking-wider text-center">Puntualidad</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-gray-400">No hay datos que coincidan con los filtros.</td>
                                        </tr>
                                    ) : (
                                        reportData.map((row) => (
                                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="p-4 font-bold text-gray-900">{row.nombre} {row.apellidos}</td>
                                                <td className="p-4 text-xs font-bold text-gray-500 uppercase">{row.rol}</td>
                                                {metrics.days && <td className="p-4 text-center font-mono">{row.diasTrabajados}</td>}
                                                {metrics.hours && <td className="p-4 text-center font-bold text-blue-700">{row.totalHoras} h</td>}
                                                {metrics.overtime && <td className="p-4 text-center font-bold text-orange-600 bg-orange-50/30">
                                                    {row.totalExtras > 0 ? `+${row.totalExtras}` : '-'}
                                                </td>}
                                                {metrics.km && <td className="p-4 text-center font-mono text-gray-600">{row.totalKm}</td>}
                                                {metrics.fuel && <td className="p-4 text-center font-mono text-purple-700">{row.totalLitros} L</td>}
                                                {metrics.punctuality && <td className={`p-4 text-center font-bold ${row.puntualidadMedia > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {row.puntualidadMedia > 0 ? `+${row.puntualidadMedia}m` : `${row.puntualidadMedia}m`}
                                                </td>}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
