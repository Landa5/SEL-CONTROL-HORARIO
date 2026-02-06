'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

function JornadasContent() {
    const [jornadas, setJornadas] = useState<any[]>([]);
    const searchParams = useSearchParams();

    useEffect(() => {
        fetchJornadas();
    }, [searchParams]);

    const fetchJornadas = async () => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('admin', 'true');
        const res = await fetch(`/api/jornadas?${params.toString()}`);
        if (res.ok) setJornadas(await res.json());
    };

    const formatDuration = (hoursDecimal: number | null) => {
        if (!hoursDecimal) return '-';
        const hours = Math.floor(hoursDecimal);
        const minutes = Math.round((hoursDecimal - hours) * 60);
        return `${hours}h ${minutes}m`;
    };

    const groupedJornadas = jornadas.reduce((acc: any, jor) => {
        const dateKey = format(new Date(jor.fecha), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(jor);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedJornadas).sort((a, b) => b.localeCompare(a));

    const exportCSV = () => {
        const headers = ['ID', 'Empleado', 'Fecha', 'Entrada', 'Salida', 'Duración', 'Estado', 'KM Totales', 'Total Descargas'];
        const rows = jornadas.flatMap(jor => {
            let kmTotal = 0;
            let countDescargas = 0;

            jor.usosCamion.forEach((t: any) => {
                if (t.kmFinal) kmTotal += (parseInt(t.kmFinal) - parseInt(t.kmInicial));
                countDescargas += t.descargas.length;
            });

            return [
                jor.id,
                jor.empleado.nombre,
                format(new Date(jor.fecha), 'yyyy-MM-dd'),
                format(new Date(jor.horaEntrada), 'HH:mm'),
                jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : 'En curso',
                formatDuration(jor.totalHoras),
                jor.estado,
                kmTotal,
                countDescargas
            ].join(',');
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(','), ...rows].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "informe_jornadas.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Informes de Jornada</h1>
                    <p className="text-gray-500 text-sm">Registro histórico detallado de actividad y kilómetros.</p>
                </div>
                <Button onClick={exportCSV} variant="secondary" className="gap-2 shadow-sm font-bold bg-gray-900 text-white hover:bg-gray-800">
                    <Download className="w-4 h-4" /> EXPORTAR CSV
                </Button>
            </div>

            <div className="space-y-8">
                {sortedDates.length === 0 ? (
                    <Card><CardContent className="p-12 text-center text-gray-400 italic">No hay registros para mostrar</CardContent></Card>
                ) : sortedDates.map(date => (
                    <div key={date} className="space-y-3">
                        <div className="flex items-center gap-2 px-2">
                            <div className="h-6 w-1 bg-blue-600 rounded-full"></div>
                            <h3 className="font-black text-gray-900 uppercase tracking-tighter">
                                {format(new Date(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                            </h3>
                        </div>
                        <Card className="shadow-sm border-0 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b bg-gray-50/50">
                                                <th className="p-4 font-bold text-gray-600">Empleado</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Entrada</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Salida</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Total</th>
                                                <th className="p-4 font-bold text-gray-600 text-center text-indigo-600">KM</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Descargas</th>
                                                <th className="p-4 font-bold text-gray-600 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedJornadas[date].map((jor: any) => {
                                                const totalKm = jor.usosCamion?.reduce((acc: number, t: any) => acc + ((t.kmFinal || t.kmInicial) - t.kmInicial), 0) || 0;
                                                return (
                                                    <tr key={jor.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs uppercase">
                                                                    {jor.empleado?.nombre?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="font-bold text-gray-900">{jor.empleado?.nombre}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-center font-mono text-gray-600">
                                                            <span className="bg-gray-100 px-2 py-1 rounded">{format(new Date(jor.horaEntrada), 'HH:mm')}</span>
                                                        </td>
                                                        <td className="p-4 text-center font-mono text-gray-500">
                                                            <span className="bg-gray-100 px-2 py-1 rounded">{jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : '--:--'}</span>
                                                        </td>
                                                        <td className="p-4 font-bold text-blue-700 text-center">
                                                            {formatDuration(jor.totalHoras)}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="font-black text-indigo-600">{totalKm} km</span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className="bg-orange-50 text-orange-700 font-bold px-2 py-1 rounded text-xs">
                                                                {jor.usosCamion.reduce((acc: number, t: any) => acc + (t.descargas?.length || 0), 0)}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${jor.estado === 'CERRADA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {jor.estado}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function AdminJornadas() {
    return (
        <Suspense fallback={
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        }>
            <JornadasContent />
        </Suspense>
    );
}
