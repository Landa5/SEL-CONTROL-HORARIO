'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Calendar, Users, Clock, Award, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReporteCompensaciones() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReporte();
    }, []);

    const fetchReporte = async () => {
        setLoading(true);
        const res = await fetch('/api/admin/compensaciones');
        if (res.ok) setData(await res.json());
        setLoading(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Trazabilidad de Festivos Trabajados</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Award className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Total Días Extras</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {data.filter(c => c.tipo === 'DIA_VACACIONES').length}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Clock className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Total Horas Extra</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {data.filter(c => c.tipo === 'HORAS_EXTRA').reduce((acc, curr) => acc + curr.valor, 0).toFixed(2)}h
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-blue-100 shadow-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Users className="w-5 h-5" /></div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Empleados Compensados</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {new Set(data.map(c => c.empleadoId)).size}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-white border-blue-100 shadow-md">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        Registro de Compensaciones
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-gray-50 text-left">
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Empleado</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Festivo Trabajado</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Fecha Jornada</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Tipo Compensación</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">Cargando datos...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-gray-400">No hay registros de compensación.</td></tr>
                                ) : (
                                    data.map((item) => (
                                        <tr key={item.id} className="hover:bg-blue-50/30">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{item.empleado.nombre}</div>
                                                <div className="text-xs text-gray-500">{item.empleado.rol}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-blue-700">{item.fiesta.nombre}</div>
                                                <div className="text-xs text-gray-400">{format(new Date(item.fiesta.fecha), 'dd MMMM', { locale: es })}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {format(new Date(item.jornada.fecha), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.tipo === 'DIA_VACACIONES' ?
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1">
                                                        <Plus className="w-3 h-3" /> Día de Vacaciones
                                                    </span> :
                                                    <span className="text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full text-xs font-bold flex items-center w-fit gap-1">
                                                        <Clock className="w-3 h-3" /> Horas Extra
                                                    </span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-bold">
                                                {item.tipo === 'DIA_VACACIONES' ? '+1 día' : `+${item.valor.toFixed(2)}h`}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
const Plus = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
