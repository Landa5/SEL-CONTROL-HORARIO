'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Clock, AlertTriangle, CheckCircle, Calendar as CalendarIcon, Save, Edit3, Palmtree, TrendingUp } from 'lucide-react';

interface NominaLinea {
    codigo: string;
    nombre: string;
    cantidad: number;
    rate: number;
    importe: number;
    notas?: string;
}

interface MonthlyEmployeeViewProps {
    employeeId: number;
    year: number;
    month: number;
}

export default function MonthlyEmployeeView({ employeeId, year, month }: MonthlyEmployeeViewProps) {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // --- Payroll editable state ---
    const [nominaLineas, setNominaLineas] = useState<NominaLinea[]>([]);
    const [nominaStatus, setNominaStatus] = useState<string>('NUEVO');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [nominaLoaded, setNominaLoaded] = useState(false);

    // Initialize payroll lines from report data
    const initNominaFromReport = useCallback((data: any) => {
        const lines: NominaLinea[] = [];
        const s = data.summary;
        const shifts = data.shifts || [];

        // Calculate totals from shifts
        let totalKm = 0, totalDescargas = 0, totalViajes = 0;
        shifts.forEach((sh: any) => {
            totalKm += (sh.km || 0);
            totalDescargas += (sh.descargas || 0);
            totalViajes += (sh.viajes || 0);
        });

        // KM line
        const kmRate = data.incentives?.find((i: any) => i.codigo === 'PRECIO_KM')?.precio || 0;
        lines.push({ codigo: 'PRECIO_KM', nombre: 'Kilometraje', cantidad: totalKm, rate: kmRate, importe: totalKm * kmRate });

        // Descargas line
        const descRate = data.incentives?.find((i: any) => i.codigo === 'PRECIO_DESCARGA')?.precio || 0;
        lines.push({ codigo: 'DESCARGAS', nombre: 'Descargas', cantidad: totalDescargas, rate: descRate, importe: totalDescargas * descRate });

        // Horas Extra
        const horasExtra = s.totalOvertime || 0;
        const heRate = data.incentives?.find((i: any) => i.codigo === 'HORAS_EXTRA')?.precio || 0;
        lines.push({ codigo: 'HORAS_EXTRA', nombre: 'Horas Extra', cantidad: parseFloat(horasExtra.toFixed(2)), rate: heRate, importe: parseFloat((horasExtra * heRate).toFixed(2)) });

        // Vacaciones
        const vacDays = shifts.filter((sh: any) => sh.dayType === 'VACACIONES').length;
        lines.push({ codigo: 'VACACIONES', nombre: 'Vacaciones', cantidad: vacDays, rate: 0, importe: 0, notas: `${vacDays} días` });

        // Horas Trabajadas (reference)
        lines.push({ codigo: 'HORAS_TRABAJADAS', nombre: 'Horas Trabajadas', cantidad: parseFloat((s.totalHours || 0).toFixed(2)), rate: 0, importe: 0, notas: `de ${(s.expectedHours || 0).toFixed(1)}h esperadas` });

        // Add existing incentives that are not already covered
        const coveredCodes = ['PRECIO_KM', 'DESCARGAS', 'HORAS_EXTRA', 'VACACIONES', 'HORAS_TRABAJADAS'];
        (data.incentives || []).forEach((inc: any) => {
            if (!coveredCodes.includes(inc.codigo)) {
                lines.push({ codigo: inc.codigo, nombre: inc.nombre, cantidad: inc.cantidad, rate: inc.precio, importe: inc.total });
            }
        });

        return lines;
    }, []);

    // Load report
    useEffect(() => {
        if (!employeeId) return;
        const fetchData = async () => {
            setLoading(true);
            setNominaLoaded(false);
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

    // Load saved payroll or init from report
    useEffect(() => {
        if (!reportData || nominaLoaded) return;
        const loadNomina = async () => {
            try {
                const res = await fetch(`/api/admin/informes/mensuales/empleado/nomina?empleadoId=${employeeId}&year=${year}&month=${month}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.nomina && data.nomina.lineas && data.nomina.lineas.length > 0) {
                        setNominaStatus(data.nomina.estado);
                        setNominaLineas(data.nomina.lineas.map((l: any) => ({
                            codigo: l.conceptoCodigo,
                            nombre: l.conceptoNombre,
                            cantidad: l.cantidad,
                            rate: l.rate,
                            importe: l.importe,
                            notas: l.notas
                        })));
                        setNominaLoaded(true);
                        return;
                    }
                }
            } catch (e) { console.error(e); }
            // No saved data, init from report
            setNominaLineas(initNominaFromReport(reportData));
            setNominaStatus('NUEVO');
            setNominaLoaded(true);
        };
        loadNomina();
    }, [reportData, employeeId, year, month, nominaLoaded, initNominaFromReport]);

    // Update a line field
    const updateLinea = (idx: number, field: 'cantidad' | 'rate' | 'importe' | 'notas', value: string) => {
        setNominaLineas(prev => {
            const updated = [...prev];
            const line = { ...updated[idx] };
            if (field === 'notas') {
                line.notas = value;
            } else {
                const num = parseFloat(value) || 0;
                line[field] = num;
                if (field === 'cantidad' || field === 'rate') {
                    line.importe = parseFloat((line.cantidad * line.rate).toFixed(2));
                }
            }
            updated[idx] = line;
            return updated;
        });
        setSaveMsg(null);
    };

    // Save payroll
    const saveNomina = async () => {
        setSaving(true);
        setSaveMsg(null);
        try {
            const res = await fetch('/api/admin/informes/mensuales/empleado/nomina', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleadoId: employeeId, year, month, lineas: nominaLineas })
            });
            if (res.ok) {
                setSaveMsg('✓ Nómina guardada correctamente');
                setNominaStatus('BORRADOR');
            } else {
                const err = await res.json();
                setSaveMsg(`✗ Error: ${err.error}`);
            }
        } catch (e) {
            setSaveMsg('✗ Error de conexión');
        }
        setSaving(false);
    };

    const nominaTotal = nominaLineas.reduce((sum, l) => sum + l.importe, 0);

    if (loading) return <div className="p-8 text-center flex justify-center items-center"><Loader2 className="animate-spin inline mr-2" /> Cargando informe...</div>;
    if (!reportData) return <div className="p-8 text-center text-gray-500">Sin datos disponibles</div>;

    const { employee, summary, shifts = [] } = reportData || {};

    // Safety check
    if (!employee || !summary) return <div className="p-8 text-center text-red-500">Error en el formato del informe.</div>;

    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    const getShiftForDay = (date: any) => {
        return shifts.find((s: any) => {
            if (!s.date) return false;
            try {
                return isSameDay(parseISO(s.date), date);
            } catch (e) {
                return false;
            }
        });
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
                        <div className="text-3xl font-black text-gray-800">{(summary.totalHours || 0).toFixed(1)}h</div>
                        <p className="text-xs text-blue-500 mt-1">de {(summary.expectedHours || 0).toFixed(1)}h esperadas</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-orange-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><AlertTriangle className="w-12 h-12 text-orange-500" /></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Horas Extra</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-orange-600">
                            {summary.totalOvertime > 0 ? `+${(summary.totalOvertime || 0).toFixed(1)}h` : '0h'}
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

                {/* INCENTIVES SUMMARY CARD */}
                <Card className="bg-white border-purple-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><span className="text-4xl text-purple-500 font-black">€</span></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Incentivos Est.</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-purple-700">{(reportData.incentivesTotal || 0).toFixed(2)} €</div>
                        <p className="text-xs text-purple-500 mt-1">Estimación bruta</p>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════════════════════════════════════════ */}
            {/* RESUMEN NÓMINA EDITABLE                        */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Resumen Nómina</h3>
                            <p className="text-emerald-100 text-xs">Datos editables para generación de nómina · {nominaStatus === 'NUEVO' ? 'Sin guardar' : `Estado: ${nominaStatus}`}</p>
                        </div>
                    </div>
                    <button
                        onClick={saveNomina}
                        disabled={saving || nominaStatus === 'CERRADA'}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Guardar Nómina'}
                    </button>
                </div>

                {saveMsg && (
                    <div className={`px-6 py-2 text-sm font-bold ${saveMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {saveMsg}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 uppercase text-xs font-bold text-gray-500 border-b">
                            <tr>
                                <th className="px-6 py-3">Concepto</th>
                                <th className="px-4 py-3 text-center">Cantidad</th>
                                <th className="px-4 py-3 text-center">Precio Unit. (€)</th>
                                <th className="px-4 py-3 text-right">Total (€)</th>
                                <th className="px-4 py-3 text-center">Notas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {nominaLineas.map((linea, idx) => {
                                const isEditable = nominaStatus !== 'CERRADA';
                                const isHighlight = ['PRECIO_KM', 'DESCARGAS', 'HORAS_EXTRA'].includes(linea.codigo);
                                const isVacation = linea.codigo === 'VACACIONES';
                                const isHours = linea.codigo === 'HORAS_TRABAJADAS';
                                let rowBg = 'hover:bg-gray-50';
                                if (isHighlight) rowBg = 'bg-emerald-50/50 hover:bg-emerald-50';
                                if (isVacation) rowBg = 'bg-amber-50/50 hover:bg-amber-50';
                                if (isHours) rowBg = 'bg-blue-50/50 hover:bg-blue-50';

                                return (
                                    <tr key={linea.codigo + idx} className={`transition-colors ${rowBg}`}>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                {isVacation && <Palmtree className="w-4 h-4 text-amber-500" />}
                                                {isHours && <Clock className="w-4 h-4 text-blue-500" />}
                                                {isHighlight && <Edit3 className="w-3 h-3 text-emerald-400" />}
                                                <span className="font-bold text-gray-800">{linea.nombre}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-mono">{linea.codigo}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                step="any"
                                                value={linea.cantidad}
                                                onChange={e => updateLinea(idx, 'cantidad', e.target.value)}
                                                disabled={!isEditable}
                                                className="w-24 text-center font-mono font-bold text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition-all"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                step="any"
                                                value={linea.rate}
                                                onChange={e => updateLinea(idx, 'rate', e.target.value)}
                                                disabled={!isEditable}
                                                className="w-24 text-center font-mono font-bold text-gray-700 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition-all"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <input
                                                type="number"
                                                step="any"
                                                value={linea.importe}
                                                onChange={e => updateLinea(idx, 'importe', e.target.value)}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono font-black text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none disabled:bg-gray-100 disabled:text-gray-400 transition-all"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="text"
                                                value={linea.notas || ''}
                                                onChange={e => updateLinea(idx, 'notas', e.target.value)}
                                                disabled={!isEditable}
                                                placeholder="—"
                                                className="w-full max-w-[160px] text-center text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-emerald-400 outline-none disabled:bg-gray-100 transition-all"
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 border-t-2 border-emerald-200">
                                <td colSpan={3} className="px-6 py-4 text-right font-black text-emerald-800 uppercase text-sm">Total Nómina Variable</td>
                                <td className="px-4 py-4 text-right font-black text-2xl text-emerald-700">{nominaTotal.toFixed(2)} €</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* INCENTIVES TABLE DETAIL */}
            {reportData.incentives && reportData.incentives.length > 0 && (
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                        <span className="bg-purple-100 text-purple-600 p-1 rounded"><CalendarIcon className="w-4 h-4" /></span>
                        Estimación Económica e Incentivos
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 uppercase text-xs font-bold text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Concepto</th>
                                    <th className="px-4 py-3 text-center">Tipo</th>
                                    <th className="px-4 py-3 text-right">Cantidad / Base</th>
                                    <th className="px-4 py-3 text-right">Precio Unitario</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {reportData.incentives.map((inc: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-gray-900">{inc.nombre}</p>
                                            {inc.meta && <p className="text-xs text-green-600">{inc.meta}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                                                ${inc.tipo === 'FIJO' ? 'bg-blue-100 text-blue-700' :
                                                    inc.tipo === 'VARIABLE' ? 'bg-orange-100 text-orange-700' :
                                                        inc.tipo === 'INFO' ? 'bg-teal-100 text-teal-700' :
                                                            'bg-purple-100 text-purple-700'}`}>
                                                {inc.tipo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-600">{inc.cantidad}</td>
                                        <td className="px-4 py-3 text-right font-mono text-gray-600">{inc.precio} €</td>
                                        <td className="px-4 py-3 text-right font-black text-gray-900">{inc.total.toFixed(2)} €</td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-50 border-t-2 border-gray-100">
                                    <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-500 uppercase">Total Estimado</td>
                                    <td className="px-4 py-3 text-right font-black text-xl text-purple-700">{(reportData.incentivesTotal || 0).toFixed(2)} €</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                        const isHoliday = shift?.dayType === 'HOLIDAY';
                        const isAbsence = ['VACACIONES', 'BAJA', 'PERMISO', 'AUSENCIA'].includes(shift?.dayType || '');

                        let bgColor = 'bg-white';
                        if (isWeekend) bgColor = 'bg-gray-50/50';
                        if (isHoliday) bgColor = 'bg-red-50';
                        if (isAbsence) bgColor = 'bg-green-50';
                        if (shift?.workedMinutes > 0) bgColor = 'bg-white ring-1 ring-blue-100';

                        return (
                            <div
                                key={date ? date.toISOString() : Math.random()}
                                className={`h-24 p-2 rounded border border-gray-100 transition-all hover:shadow-md relative group ${bgColor}`}
                            >
                                <span className={`text-xs font-bold ${isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {format(date, 'd')}
                                </span>

                                {shift?.workedMinutes > 0 ? (
                                    <div className="mt-1 space-y-1">
                                        {shift.allShiftTimes ? (
                                            /* Jornada partida: mostrar cada rango */
                                            <>
                                                {shift.allShiftTimes.split(', ').map((range: string, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center bg-blue-50 px-1 py-0.5 rounded">
                                                        <span className="text-[10px] font-mono text-blue-700">{range.split('-')[0]}</span>
                                                        <span className="text-[10px] font-mono text-blue-700">{range.split('-')[1]}</span>
                                                    </div>
                                                ))}
                                            </>
                                        ) : (
                                            <div className="flex justify-between items-center bg-blue-50 px-1 py-0.5 rounded">
                                                <span className="text-[10px] font-mono text-blue-700">{shift.start}</span>
                                                <span className="text-[10px] font-mono text-blue-700">{shift.end}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-bold text-gray-500">{((shift.workedMinutes || 0) / 60).toFixed(1)}h</span>
                                            {shift.punctuality !== 0 && (
                                                <span className={`text-[9px] font-bold ${getPunctualityColor(shift.punctuality)}`}>
                                                    {shift.punctuality > 0 ? `+${shift.punctuality}` : shift.punctuality}m
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-center">
                                        {isHoliday && <span className="text-[10px] text-red-500 font-bold uppercase transform -rotate-45 whitespace-nowrap">FESTIVO</span>}
                                        {isAbsence && <span className="text-[10px] text-green-600 font-bold uppercase text-center transform -rotate-45 whitespace-nowrap">{shift.dayType}</span>}
                                        {!isHoliday && !isAbsence && !isWeekend && (
                                            <span className="text-[9px] text-gray-300 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Libre</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* TABLE VIEW */}
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
                                <th className="p-3 font-bold text-gray-600 text-center">KM</th>
                                <th className="p-3 font-bold text-gray-600 text-center">Viajes</th>
                                <th className="p-3 font-bold text-gray-600 text-center">Descargas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((s: any) => (
                                <tr key={s.date} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="p-3 font-mono text-gray-600">{s.date}</td>
                                    <td className="p-3 font-mono">
                                        {s.allShiftTimes ? (
                                            <span className="text-xs">{s.allShiftTimes}</span>
                                        ) : (
                                            <>{s.start}</>  
                                        )}
                                    </td>
                                    <td className="p-3 font-mono">{s.allShiftTimes ? '' : s.end}</td>
                                    <td className="p-3 font-bold">{((s.workedMinutes || 0) / 60).toFixed(2)}h</td>
                                    <td className={`p-3 font-bold ${getPunctualityColor(s.punctuality)}`}>
                                        {s.punctuality > 0 ? `+${s.punctuality}m` : `${s.punctuality}m`}
                                    </td>
                                    <td className="p-3 font-bold text-orange-400">
                                        {s.overtimeMinutes > 0 ? `+${((s.overtimeMinutes || 0) / 60).toFixed(2)}` : '-'}
                                    </td>
                                    <td className="p-3 font-mono text-center">{s.km > 0 ? s.km : '-'}</td>
                                    <td className="p-3 font-mono text-center">{s.viajes > 0 ? s.viajes : '-'}</td>
                                    <td className="p-3 font-mono text-center">{s.descargas > 0 ? s.descargas : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
