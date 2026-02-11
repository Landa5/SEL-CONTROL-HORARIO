'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Truck,
    Calendar,
    Droplet,
    Activity,
    ArrowLeft,
    MapPin,
    Download,
    Fuel,
    TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import DocumentManager from '@/components/documents/DocumentManager';

export default function DetalleCamionPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    // Date State (Defaults to current month)
    const [fromDate, setFromDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [toDate, setToDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchStats();
    }, [id, fromDate, toDate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/camiones/${id}/estadisticas?from=${fromDate}&to=${toDate}`);
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

    if (loading) return <div className="p-8 text-center">Calculando estadísticas...</div>;
    if (!data) return <div className="p-8 text-center">No se encontraron datos.</div>;

    const { camion, totales, diario, registros } = data;

    // Find max KM for chart scaling
    const maxKm = Math.max(...diario.map((d: any) => d.km), 100);

    return (
        <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                            <Truck className="w-8 h-8 text-blue-600" />
                            {camion.matricula}
                        </h1>
                        <p className="text-gray-500">{camion.marca} {camion.modelo} • {camion.nVin || 'Sin VIN'}</p>
                    </div>
                </div>

                {/* DATE FILTERS */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="p-2 border rounded text-sm"
                    />
                    <span className="text-gray-400">➡️</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="p-2 border rounded text-sm"
                    />
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-blue-600 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Kilómetros</p>
                                <h3 className="text-3xl font-black text-gray-900">{totales.km.toLocaleString()}</h3>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <Activity className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-600 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Consumo Medio</p>
                                <h3 className="text-3xl font-black text-gray-900 flex items-baseline gap-1">
                                    {totales.consumoMedio}
                                    <span className="text-sm text-gray-500 font-normal">L/100km</span>
                                </h3>
                            </div>
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <Fuel className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-600 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Litros Repostados</p>
                                <h3 className="text-3xl font-black text-gray-900">{totales.litros} L</h3>
                            </div>
                            <div className="p-2 bg-purple-50 rounded-lg">
                                <Droplet className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-600 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Actividad</p>
                                <div className="flex gap-4 mt-1">
                                    <div>
                                        <span className="text-xl font-bold">{totales.viajes}</span>
                                        <span className="text-xs text-gray-500 ml-1">Viajes</span>
                                    </div>
                                    <div>
                                        <span className="text-xl font-bold">{totales.descargas}</span>
                                        <span className="text-xs text-gray-500 ml-1">Descargas</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* DAILY KM CHART */}
                <Card className="lg:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle>Evolución Diaria (KM)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {diario.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-gray-400">Sin datos para mostrar</div>
                        ) : (
                            <div className="h-64 flex items-end gap-2 overflow-x-auto pb-2">
                                {diario.map((day: any) => {
                                    const heightPercentage = (day.km / maxKm) * 100;
                                    return (
                                        <div key={day.date} className="group relative flex flex-col items-center gap-1 min-w-[40px]">
                                            <div
                                                className="w-8 bg-blue-500 rounded-t hover:bg-blue-600 transition-all relative"
                                                style={{ height: `${heightPercentage}%` }}
                                            >
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                    <p className="font-bold">{day.km} KM</p>
                                                    <p className="text-[10px] text-gray-300">{format(parseISO(day.date), 'dd/MM')}</p>
                                                    {day.litros > 0 && <p className="text-[10px] text-orange-300">{day.litros} L</p>}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-gray-400 rotate-0">
                                                {format(parseISO(day.date), 'dd')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* CONSUMPTION SUMMARY */}
                <Card className="shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
                    <CardContent className="p-8 flex flex-col justify-center h-full">
                        <h3 className="text-lg font-medium text-slate-300 mb-6">Eficiencia del Periodo</h3>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm text-slate-400">Rendimiento (KM/L)</span>
                                    <span className="text-2xl font-bold">
                                        {totales.litros > 0 ? (totales.km / totales.litros).toFixed(2) : '0'}
                                        <span className="text-sm text-slate-500 ml-1">km/l</span>
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-3/4"></div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm text-slate-400">Intensidad de Uso</span>
                                    <span className="text-2xl font-bold">
                                        {diario.length}
                                        <span className="text-sm text-slate-500 ml-1">días</span>
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    {/* Simple visual based on days in range (approx 30 days) */}
                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min((diario.length / 30) * 100, 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* DOCUMENTATION SECTION */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Gestión Documental</CardTitle>
                </CardHeader>
                <CardContent>
                    {id ? (
                        <DocumentManager entityId={Number(id)} entityType="CAMION" />
                    ) : (
                        <p>Cargando...</p>
                    )}
                </CardContent>
            </Card>

            {/* DETAILED TABLE */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Registro Detallado</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4 rounded-tl-lg">Fecha</th>
                                    <th className="p-4">Conductor</th>
                                    <th className="p-4 text-center">Horario</th>
                                    <th className="p-4 text-center">KM Recorridos</th>
                                    <th className="p-4 text-center">Repostaje</th>
                                    <th className="p-4 text-right rounded-tr-lg">Actividad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {registros.map((reg: any) => (
                                    <tr key={reg.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="p-4 font-medium text-gray-900">
                                            {format(parseISO(reg.horaInicio), 'dd MMM yyyy', { locale: es })}
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {reg.jornada?.empleado?.nombre} {reg.jornada?.empleado?.apellidos}
                                        </td>
                                        <td className="p-4 text-center text-gray-500">
                                            {format(parseISO(reg.horaInicio), 'HH:mm')} -
                                            {reg.horaFin ? format(parseISO(reg.horaFin), 'HH:mm') : '...'}
                                        </td>
                                        <td className="p-4 text-center font-bold text-blue-700">
                                            {reg.kmRecorridos} km
                                        </td>
                                        <td className="p-4 text-center">
                                            {reg.litrosRepostados > 0 ? (
                                                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-bold">
                                                    {reg.litrosRepostados} L
                                                </span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {reg.viajesCount > 0 && (
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                                        {reg.viajesCount} Viajes
                                                    </span>
                                                )}
                                                {reg.descargasCount > 0 && (
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                                        {reg.descargasCount} Desc.
                                                    </span>
                                                )}
                                            </div>
                                        </td>
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
