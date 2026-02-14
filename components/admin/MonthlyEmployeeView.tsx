'use client';

import React, { useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Clock, AlertTriangle, CheckCircle, Calendar as CalendarIcon } from 'lucide-react';

interface MonthlyEmployeeViewProps {
    employeeId: number;
    year: number;
    month: number;
}

export default function MonthlyEmployeeView({ employeeId, year, month }: MonthlyEmployeeViewProps) {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!employeeId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/informes/mensuales/empleado?employeeId=${employeeId}&year=${year}&month=${month}`);
                if (res.ok) {
                    const data = await res.json();
                    setReportData(data);
                }
            } catch (error) { console.error(error); }
            setLoading(false);
        };
        fetchData();
    }, [employeeId, year, month]);

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Cargando informe...</div>;
    if (!reportData) return <div className="p-8 text-center text-gray-500">Sin datos disponibles</div>;

    const { employee, summary, shifts, daysInMonth } = reportData;

    const getShiftForDay = (date: any) => {
        return shifts.find((s: any) => isSameDay(parseISO(s.date), date));
    };

    // Helper: Get color based on punctuality average
    const getPunctualityColor = (avg: number) => {
        if (avg <= 0) return 'text-green-600'; // On time or early
        if (avg < 15) return 'text-orange-500'; // Slightly late
        return 'text-red-600'; // Late
    };

    const hasAfternoonShift = employee.horaEntradaTarde && employee.horaSalidaTarde;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex justify-between items-start bg-white p-6 rounded-xl shadow-sm border mb-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900">{employee.nombre}</h2>
                    <p className="text-gray-500 font-bold">{employee.rol}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                        <div className="bg-blue-50 text-blue-800 px-2 py-1 rounded">
                            <span className="font-bold">Horario Mañana: </span>
                            {employee.horaEntradaPrevista || '--:--'} - {employee.horaSalidaPrevista || '--:--'}
                        </div>
                        {hasAfternoonShift && (
                            <div className="bg-orange-50 text-orange-800 px-2 py-1 rounded">
                                <span className="font-bold">Horario Tarde: </span>
                                {employee.horaEntradaTarde} - {employee.horaSalidaTarde}
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase">Puntualidad Media</p>
                    <p className={`text-2xl font-black ${getPunctualityColor(summary.avgPunctuality)}`}>
                        {summary.avgPunctuality > 0 ? `+${summary.avgPunctuality}m` : `${summary.avgPunctuality}m`}
                    </p>
                </div>
            </div>

            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-blue-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Clock className="w-12 h-12 text-blue-500" /></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Horas Trabajadas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-800">{summary.totalHours.toFixed(1)}h</div>
                        <p className="text-xs text-blue-500 mt-1">de {summary.expectedHours.toFixed(1)}h esperadas</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-orange-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><AlertTriangle className="w-12 h-12 text-orange-500" /></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Horas Extra</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-orange-600">
                            {summary.totalOvertime > 0 ? `+${summary.totalOvertime.toFixed(1)}h` : '0h'}
                        </div>
                        <p className="text-xs text-orange-400 mt-1">Exceso de jornada</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-green-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><CheckCircle className="w-12 h-12 text-green-500" /></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Días Trabajados</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-gray-800">{summary.daysWorked}</div>
                        <p className="text-xs text-green-500 mt-1">Días con actividad</p>
                    </CardContent>
                </Card>
            </div>

            {/* CALENDAR VIEW */}
            <Card className="border-0 shadow-none bg-transparent">
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-2 bg-gray-50 rounded">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {/* Padding for start of month */}
                    {Array.from({ length: (getDay(daysInMonth[0]) + 6) % 7 }).map((_, i) => (
                        <div key={`pad-${i}`} className="h-24 bg-transparent" />
                    ))}

                    {daysInMonth.map((date: Date) => {
                        const shift = getShiftForDay(date);
                        const isWeekend = getDay(date) === 0 || getDay(date) === 6;

                        return (
                            <div
                                key={date.toISOString()}
                                className={`h-24 p-2 rounded border border-gray-100 transition-all hover:shadow-md relative group
                                    ${isWeekend && !shift ? 'bg-gray-50/50' : 'bg-white'}
                                    ${shift ? 'ring-1 ring-blue-100' : ''}
                                `}
                            >
                                <span className={`text-xs font-bold ${isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {format(date, 'd')}
                                </span>

                                {shift ? (
                                    <div className="mt-1 space-y-1">
                                        <div className="flex justify-between items-center bg-blue-50 px-1 py-0.5 rounded">
                                            <span className="text-[10px] font-mono text-blue-700">{shift.start}</span>
                                            <span className="text-[10px] font-mono text-blue-700">{shift.end}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-gray-500">{(shift.workedMinutes / 60).toFixed(1)}h</span>
                                            {shift.punctuality !== 0 && (
                                                <span className={`text-[9px] font-bold ${getPunctualityColor(shift.punctuality)}`}>
                                                    {shift.punctuality > 0 ? `+${shift.punctuality}` : shift.punctuality}m
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[9px] text-gray-300 font-bold uppercase">Libre</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* TABLE VIEW (Optional if Calendar is enough, but good for details) */}
            <div className="mt-8">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Detalle de Registros</h3>
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-3 font-bold text-gray-600">Fecha</th>
                                <th className="p-3 font-bold text-gray-600">Entrada</th>
                                <th className="p-3 font-bold text-gray-600">Salida</th>
                                <th className="p-3 font-bold text-gray-600">Total</th>
                                <th className="p-3 font-bold text-gray-600">Puntualidad</th>
                                <th className="p-3 font-bold text-gray-600">Extra</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((s: any) => (
                                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-3 font-mono text-gray-600">{s.date}</td>
                                    <td className="p-3 font-mono">{s.start}</td>
                                    <td className="p-3 font-mono">{s.end}</td>
                                    <td className="p-3 font-bold">{(s.workedMinutes / 60).toFixed(2)}h</td>
                                    <td className={`p-3 font-bold ${getPunctualityColor(s.punctuality)}`}>
                                        {s.punctuality > 0 ? `+${s.punctuality}m` : `${s.punctuality}m`}
                                    </td>
                                    <td className="p-3 font-bold text-orange-400">
                                        {s.overtimeMinutes > 0 ? `+${(s.overtimeMinutes / 60).toFixed(2)}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
