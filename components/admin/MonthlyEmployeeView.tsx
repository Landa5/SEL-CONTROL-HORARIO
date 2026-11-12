'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Clock, AlertTriangle, CheckCircle, Calendar as CalendarIcon, Save, Edit3, Palmtree, TrendingUp, Truck, RotateCcw, Disc, X } from 'lucide-react';

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

const OPERATIONAL_CODES = new Set([
    'PRECIO_KM',
    'PRECIO_DESCARGA',
    'PRECIO_VIAJE',
    'HORAS_EXTRA',
    'VACACIONES',
    'HORAS_TRABAJADAS'
]);

export default function MonthlyEmployeeView({ employeeId, year, month }: MonthlyEmployeeViewProps) {
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // --- Payroll editable state ---
    const [nominaLineas, setNominaLineas] = useState<NominaLinea[]>([]);
    const [nominaStatus, setNominaStatus] = useState<string>('NUEVO');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [reloadTick, setReloadTick] = useState(0);

    // --- Quick Shift Edit Modal state ---
    const [editingDay, setEditingDay] = useState<any | null>(null);
    const [editStartTime, setEditStartTime] = useState('08:00');
    const [editEndTime, setEditEndTime] = useState('16:00');
    const [editKm, setEditKm] = useState('0');
    const [editDescargas, setEditDescargas] = useState('0');
    const [editViajes, setEditViajes] = useState('0');
    const [editLitros, setEditLitros] = useState('0');
    const [savingShift, setSavingShift] = useState(false);

    // Initialize payroll lines from report data
    const initNominaFromReport = useCallback((data: any) => {
        const lines: NominaLinea[] = [];
        const s = data.summary || {};
        const shifts = data.shifts || [];

        // Calculate fallback totals from shifts if summary fields are missing
        let shiftsKm = 0, shiftsDescargas = 0, shiftsViajes = 0;
        shifts.forEach((sh: any) => {
            shiftsKm += (sh.km || 0);
            shiftsDescargas += (sh.descargas || 0);
            shiftsViajes += (sh.viajes || 0);
        });

        const totalKm = typeof s.totalKm === 'number' ? s.totalKm : shiftsKm;
        const totalDescargas = typeof s.totalDescargas === 'number' ? s.totalDescargas : shiftsDescargas;
        const totalViajes = typeof s.totalViajes === 'number' ? s.totalViajes : shiftsViajes;

        // KM line
        const kmRate = data.incentives?.find((i: any) => i.codigo === 'PRECIO_KM')?.precio || 0;
        lines.push({
            codigo: 'PRECIO_KM',
            nombre: 'Kilometraje',
            cantidad: totalKm,
            rate: kmRate,
            importe: parseFloat((totalKm * kmRate).toFixed(2))
        });

        // Descargas line (canonical code: PRECIO_DESCARGA)
        const descRate = data.incentives?.find((i: any) => i.codigo === 'PRECIO_DESCARGA' || i.codigo === 'DESCARGAS')?.precio || 0;
        lines.push({
            codigo: 'PRECIO_DESCARGA',
            nombre: 'Descargas',
            cantidad: totalDescargas,
            rate: descRate,
            importe: parseFloat((totalDescargas * descRate).toFixed(2))
        });

        // Viajes line (canonical code: PRECIO_VIAJE)
        const viajeRate = data.incentives?.find((i: any) => i.codigo === 'PRECIO_VIAJE')?.precio || 0;
        lines.push({
            codigo: 'PRECIO_VIAJE',
            nombre: 'Viajes',
            cantidad: totalViajes,
            rate: viajeRate,
            importe: parseFloat((totalViajes * viajeRate).toFixed(2))
        });

        // Horas Extra
        const horasExtra = s.totalOvertime || 0;
        const heRate = data.incentives?.find((i: any) => i.codigo === 'HORAS_EXTRA')?.precio || 0;
        lines.push({
            codigo: 'HORAS_EXTRA',
            nombre: 'Horas Extra',
            cantidad: parseFloat(horasExtra.toFixed(2)),
            rate: heRate,
            importe: parseFloat((horasExtra * heRate).toFixed(2))
        });

        // Vacaciones
        const vacDays = typeof s.diasVacaciones === 'number'
            ? s.diasVacaciones
            : shifts.filter((sh: any) => sh.dayType === 'VACACIONES').length;
        lines.push({
            codigo: 'VACACIONES',
            nombre: 'Vacaciones',
            cantidad: vacDays,
            rate: 0,
            importe: 0,
            notas: `${vacDays} días`
        });

        // Horas Trabajadas (reference)
        lines.push({
            codigo: 'HORAS_TRABAJADAS',
            nombre: 'Horas Trabajadas',
            cantidad: parseFloat((s.totalHours || 0).toFixed(2)),
            rate: 0,
            importe: 0,
            notas: `de ${(s.expectedHours || 0).toFixed(1)}h esperadas`
        });

        // Add existing incentives that are not already covered
        const coveredCodes = [
            'PRECIO_KM',
            'PRECIO_DESCARGA',
            'DESCARGAS',
            'PRECIO_VIAJE',
            'HORAS_EXTRA',
            'VACACIONES',
            'HORAS_TRABAJADAS'
        ];
        (data.incentives || []).forEach((inc: any) => {
            if (!coveredCodes.includes(inc.codigo)) {
                lines.push({
                    codigo: inc.codigo,
                    nombre: inc.nombre,
                    cantidad: inc.cantidad,
                    rate: inc.precio,
                    importe: parseFloat((inc.total || 0).toFixed(2)),
                    notas: inc.meta
                });
            }
        });

        return lines;
    }, []);

    // Unified load of report + saved payroll to avoid race conditions when switching employees/months
    useEffect(() => {
        if (!employeeId) return;
        let isCancelled = false;

        const fetchAll = async () => {
            setLoading(true);
            setSaveMsg(null);
            setReportData(null);
            setNominaLineas([]);

            try {
                const [reportRes, nominaRes] = await Promise.all([
                    fetch(`/api/admin/informes/mensuales/empleado?employeeId=${employeeId}&year=${year}&month=${month}`),
                    fetch(`/api/admin/informes/mensuales/empleado/nomina?empleadoId=${employeeId}&year=${year}&month=${month}`)
                ]);

                if (isCancelled) return;

                if (!reportRes.ok) {
                    setLoading(false);
                    return;
                }

                const repData = await reportRes.json();
                if (isCancelled) return;

                setReportData(repData);
                const freshLines = initNominaFromReport(repData);

                if (nominaRes.ok) {
                    const nomData = await nominaRes.json();
                    if (!isCancelled && nomData.nomina && Array.isArray(nomData.nomina.lineas) && nomData.nomina.lineas.length > 0) {
                        const status = nomData.nomina.estado || 'BORRADOR';
                        setNominaStatus(status);

                        // Normalize legacy DESCARGAS -> PRECIO_DESCARGA and deduplicate
                        const normalizedSaved: NominaLinea[] = [];
                        const seenCodes = new Set<string>();

                        for (const l of nomData.nomina.lineas) {
                            const canonicalCode = l.conceptoCodigo === 'DESCARGAS' ? 'PRECIO_DESCARGA' : l.conceptoCodigo;
                            if (seenCodes.has(canonicalCode)) continue;
                            seenCodes.add(canonicalCode);
                            normalizedSaved.push({
                                codigo: canonicalCode,
                                nombre: l.conceptoNombre,
                                cantidad: l.cantidad,
                                rate: l.rate,
                                importe: l.importe,
                                notas: l.notas
                            });
                        }

                        // Check if this saved payroll was generated by /api/nominas/generar (bundled DIETAS/DISPONIBILIDAD/PRODUCTIVIDAD without operational lines)
                        const hasSavedOperationalLines = normalizedSaved.some(l =>
                            ['PRECIO_KM', 'PRECIO_DESCARGA', 'PRECIO_VIAJE'].includes(l.codigo)
                        );

                        if (status !== 'CERRADA' && !hasSavedOperationalLines) {
                            // Use fresh itemized operational lines + keep any fixed non-bundled extras (e.g. PRODUCTIVIDAD_FIJA, INCENTIVOS)
                            const bundledCodes = new Set(['DIETAS', 'DISPONIBILIDAD', 'PRODUCTIVIDAD']);
                            const merged = [...freshLines];
                            const freshCodes = new Set(freshLines.map(f => f.codigo));
                            normalizedSaved.forEach(sLine => {
                                if (!bundledCodes.has(sLine.codigo) && !freshCodes.has(sLine.codigo)) {
                                    merged.push(sLine);
                                }
                            });
                            setNominaLineas(merged);
                            setLoading(false);
                            return;
                        }

                        // Merge saved lines with fresh live quantities when in BORRADOR
                        const mergedLines = normalizedSaved.map(saved => {
                            const fresh = freshLines.find(f => f.codigo === saved.codigo);
                            if (!fresh) return saved;

                            const effectiveRate = saved.rate > 0 ? saved.rate : fresh.rate;
                            // In BORRADOR, always sync operational quantities (KM, descargas, viajes, horas) with real worker records
                            if (status !== 'CERRADA' && OPERATIONAL_CODES.has(saved.codigo)) {
                                const liveCantidad = fresh.cantidad;
                                return {
                                    ...saved,
                                    cantidad: liveCantidad,
                                    rate: effectiveRate,
                                    importe: parseFloat((liveCantidad * effectiveRate).toFixed(2)),
                                    notas: saved.codigo === 'HORAS_TRABAJADAS' || saved.codigo === 'VACACIONES' ? fresh.notas : saved.notas
                                };
                            }

                            if (saved.rate === 0 && fresh.rate > 0) {
                                return {
                                    ...saved,
                                    rate: fresh.rate,
                                    importe: parseFloat((saved.cantidad * fresh.rate).toFixed(2))
                                };
                            }
                            return saved;
                        });

                        // Add any missing concepts from fresh data
                        const savedCodes = new Set(mergedLines.map(l => l.codigo));
                        freshLines.forEach(fresh => {
                            if (!savedCodes.has(fresh.codigo)) {
                                mergedLines.push(fresh);
                            }
                        });

                        setNominaLineas(mergedLines);
                        setLoading(false);
                        return;
                    }
                }

                // No saved payroll: initialize directly from real worker report data
                setNominaLineas(freshLines);
                setNominaStatus('NUEVO');
            } catch (error) {
                console.error(error);
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchAll();

        return () => {
            isCancelled = true;
        };
    }, [employeeId, year, month, reloadTick, initNominaFromReport]);

    const handleOpenEditDay = (s: any) => {
        setEditingDay(s);
        setEditStartTime(s.start && s.start !== '--:--' ? s.start : (reportData?.employee?.horaEntradaPrevista || '08:00'));
        setEditEndTime(s.end && s.end !== '--:--' && s.end !== 'En curso' ? s.end : (reportData?.employee?.horaSalidaPrevista || '16:00'));
        setEditKm(String(s.km || 0));
        setEditDescargas(String(s.descargas || 0));
        setEditViajes(String(s.viajes || 0));
        setEditLitros(String(s.litros || 0));
    };

    const handleSaveEditDay = async () => {
        if (!editingDay) return;
        setSavingShift(true);
        try {
            const res = await fetch('/api/admin/informes/mensuales/empleado/jornada', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jornadaId: editingDay.id,
                    usoId: editingDay.usoId,
                    empleadoId: employeeId,
                    date: editingDay.date,
                    startTime: editStartTime,
                    endTime: editEndTime,
                    km: editKm,
                    descargas: editDescargas,
                    viajes: editViajes,
                    litros: editLitros
                })
            });
            if (res.ok) {
                setEditingDay(null);
                setReloadTick(t => t + 1);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.error || 'Error al guardar cambios de la jornada');
            }
        } finally {
            setSavingShift(false);
        }
    };

    const handleResetFromRealData = () => {
        if (!reportData) return;
        setNominaLineas(initNominaFromReport(reportData));
        setSaveMsg('✓ Datos sincronizados con los fichajes reales del trabajador (pulsa Guardar Nómina para confirmar)');
    };

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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

                <Card className="bg-white border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Truck className="w-12 h-12 text-indigo-500" /></div>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-gray-400 uppercase">Actividad Ruta</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-indigo-900">{(summary.totalKm || 0).toLocaleString()} km</div>
                        <p className="text-xs text-indigo-500 mt-1 font-semibold">
                            {summary.totalDescargas || 0} desc. · {summary.totalViajes || 0} viajes
                        </p>
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
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Resumen Nómina</h3>
                            <p className="text-emerald-100 text-xs">Datos editables para generación de nómina · {nominaStatus === 'NUEVO' ? 'Sin guardar' : `Estado: ${nominaStatus}`}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {nominaStatus !== 'CERRADA' && (
                            <button
                                onClick={handleResetFromRealData}
                                title="Sincronizar cantidades con los datos reales fichados por el trabajador"
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700/60 text-white border border-white/20 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Sincronizar Reales
                            </button>
                        )}
                        <button
                            onClick={saveNomina}
                            disabled={saving || nominaStatus === 'CERRADA'}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Guardando...' : 'Guardar Nómina'}
                        </button>
                    </div>
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
                                const isHighlight = ['PRECIO_KM', 'PRECIO_DESCARGA', 'DESCARGAS', 'PRECIO_VIAJE', 'HORAS_EXTRA'].includes(linea.codigo);
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

                {/* VISTA PREVIA REPARTO GESTORÍA (UNIFICADO CON NÓMINAS) */}
                {(() => {
                    const gc = reportData.gestoriaConfig || {};
                    const isConductorOrMecanico = employee.rol === 'CONDUCTOR' || employee.rol === 'MECANICO';
                    const kmImp = nominaLineas.find(l => l.codigo === 'PRECIO_KM')?.importe || 0;
                    const descImp = nominaLineas.find(l => l.codigo === 'PRECIO_DESCARGA' || l.codigo === 'DESCARGAS')?.importe || 0;
                    const viajeImp = nominaLineas.find(l => l.codigo === 'PRECIO_VIAJE')?.importe || 0;
                    const heImp = nominaLineas.find(l => l.codigo === 'HORAS_EXTRA')?.importe || 0;
                    const prodFijaImp = nominaLineas.find(l => l.codigo === 'PRODUCTIVIDAD_FIJA')?.importe ?? (gc.productividadFija || 0);
                    const incentivosImp = nominaLineas.find(l => l.codigo === 'INCENTIVOS')?.importe ?? (gc.incentivosFijos || 0);

                    const dietasBase = gc.dietasBase || 0;
                    const topeDieta = gc.dietaTope ?? 375;
                    const pctProd = gc.pctProductividad || 50;

                    let colDietas = 0;
                    let colPresencia = heImp;
                    let colProductividad = prodFijaImp;
                    const colIncentivos = incentivosImp;

                    if (isConductorOrMecanico) {
                        const pot = kmImp + descImp + viajeImp + dietasBase;
                        colDietas = Math.min(topeDieta, Math.max(0, pot));
                        const resto = Math.max(0, pot - colDietas);
                        const factorProd = pctProd / 100;
                        colPresencia += resto * (1 - factorProd);
                        const dtoVac = (summary.diasVacaciones || 0) * (gc.descuentoVacaciones || 0);
                        const dtoAus = (summary.diasAusencia || 0) * (gc.descuentoAusencia || 0);
                        colProductividad += Math.max(0, (resto * factorProd) - dtoVac - dtoAus);
                    } else {
                        colDietas = dietasBase + kmImp + descImp + viajeImp;
                    }

                    const totalGestoria = colDietas + colPresencia + colProductividad + colIncentivos;

                    return (
                        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                <div>
                                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                                        📊 Equivalencia Columnas Gestoría (Hoja Resumen)
                                    </span>
                                    <p className="text-[11px] text-slate-400">
                                        Reparto automático de variables (Tope Dietas: {topeDieta}€ · Resto {100 - pctProd}% Disp. / {pctProd}% Prod.)
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full md:w-auto text-center">
                                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Dietas / KM</div>
                                        <div className="text-sm font-black text-slate-800">{colDietas.toFixed(2)} €</div>
                                    </div>
                                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">H. Presencia / Ext</div>
                                        <div className="text-sm font-black text-slate-800">{colPresencia.toFixed(2)} €</div>
                                    </div>
                                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Productividad</div>
                                        <div className="text-sm font-black text-slate-800">{colProductividad.toFixed(2)} €</div>
                                    </div>
                                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Incentivos</div>
                                        <div className="text-sm font-black text-slate-800">{colIncentivos.toFixed(2)} €</div>
                                    </div>
                                    <div className="bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase">Total Gestoría</div>
                                        <div className="text-sm font-black text-emerald-900">{totalGestoria.toFixed(2)} €</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* CRUCE APP VS TACÓGRAFO DIGITAL */}
            {reportData.tachographSummary?.linkedDriver && (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-2.5 rounded-lg">
                            <Disc className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-indigo-950 uppercase">Cruce App vs Tacógrafo Digital</h4>
                            <p className="text-xs text-indigo-700">
                                Tarjeta vinculada: <span className="font-mono font-bold">{reportData.tachographSummary.linkedDriver.cardNumber || reportData.tachographSummary.linkedDriver.fullName}</span>
                                {' · '}{reportData.tachographSummary.daysWithData} día(s) con lecturas de tacógrafo este mes
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4 text-center">
                        <div className="bg-white px-3.5 py-2 rounded-lg border border-indigo-100">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase">Horas Fichaje App</span>
                            <span className="text-base font-black text-blue-700">{(summary.totalHours || 0).toFixed(1)}h</span>
                        </div>
                        <div className="bg-white px-3.5 py-2 rounded-lg border border-indigo-100">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase">Conducción Tacógrafo</span>
                            <span className="text-base font-black text-indigo-700">{(reportData.tachographSummary.drivingHours || 0).toFixed(1)}h</span>
                        </div>
                        <div className="bg-white px-3.5 py-2 rounded-lg border border-indigo-100">
                            <span className="block text-[10px] font-bold text-gray-400 uppercase">Trabajo Total Tacóg.</span>
                            <span className="text-base font-black text-purple-700">{(reportData.tachographSummary.totalWorkHours || 0).toFixed(1)}h</span>
                        </div>
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
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase">Detalle de Registros (Haz clic en ✏️ para editar cualquier día)</h3>
                </div>
                <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
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
                                <th className="p-3 font-bold text-gray-600">Avisos</th>
                                <th className="p-3 font-bold text-gray-600 text-center">Editar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((s: any) => {
                                const hasAnomalies = Array.isArray(s.anomalies) && s.anomalies.length > 0;
                                return (
                                    <tr key={s.date} className={`border-b last:border-0 hover:bg-gray-50 ${hasAnomalies ? 'bg-amber-50/40' : ''}`}>
                                        <td className="p-3 font-mono text-gray-600">{s.date}</td>
                                        <td className="p-3 font-mono">
                                            {s.allShiftTimes ? (
                                                <span className="text-xs">{s.allShiftTimes}</span>
                                            ) : (
                                                <>{s.start}</>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">{s.allShiftTimes ? '' : s.end}</td>
                                        <td className="p-3 font-bold">
                                            {((s.workedMinutes || 0) / 60).toFixed(2)}h
                                            {s.tachoWorkMinutes > 0 && (
                                                <span className="block text-[10px] font-mono text-indigo-600" title="Horas registradas en Tacógrafo Digital">
                                                    Tac: {(s.tachoWorkMinutes / 60).toFixed(1)}h
                                                </span>
                                            )}
                                        </td>
                                        <td className={`p-3 font-bold ${getPunctualityColor(s.punctuality)}`}>
                                            {s.punctuality > 0 ? `+${s.punctuality}m` : `${s.punctuality}m`}
                                        </td>
                                        <td className="p-3 font-bold text-orange-400">
                                            {s.overtimeMinutes > 0 ? `+${((s.overtimeMinutes || 0) / 60).toFixed(2)}` : '-'}
                                        </td>
                                        <td className="p-3 font-mono text-center">{s.km > 0 ? s.km : '-'}</td>
                                        <td className="p-3 font-mono text-center">{s.viajes > 0 ? s.viajes : '-'}</td>
                                        <td className="p-3 font-mono text-center">{s.descargas > 0 ? s.descargas : '-'}</td>
                                        <td className="p-3">
                                            {hasAnomalies ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {s.anomalies.map((anom: string, i: number) => (
                                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                            {anom}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => handleOpenEditDay(s)}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title={`Editar registro del ${s.date}`}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL EDICIÓN RÁPIDA DE JORNADA / RUTA */}
            {editingDay && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-blue-600 px-5 py-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-base uppercase">Editar Registro · {editingDay.date}</h3>
                                <p className="text-xs text-blue-100">{employee.nombre}</p>
                            </div>
                            <button onClick={() => setEditingDay(null)} className="text-white/80 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Hora Entrada</label>
                                    <input
                                        type="time"
                                        value={editStartTime}
                                        onChange={e => setEditStartTime(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Hora Salida</label>
                                    <input
                                        type="time"
                                        value={editEndTime}
                                        onChange={e => setEditEndTime(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                <div>
                                    <label className="block text-xs font-bold text-indigo-700 uppercase mb-1">KM Recorridos</label>
                                    <input
                                        type="number"
                                        value={editKm}
                                        onChange={e => setEditKm(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Descargas</label>
                                    <input
                                        type="number"
                                        value={editDescargas}
                                        onChange={e => setEditDescargas(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-700 uppercase mb-1">Viajes</label>
                                    <input
                                        type="number"
                                        value={editViajes}
                                        onChange={e => setEditViajes(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-orange-700 uppercase mb-1">Litros Repostados</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={editLitros}
                                        onChange={e => setEditLitros(e.target.value)}
                                        className="w-full border rounded-lg px-3 py-2 font-mono font-bold text-gray-800"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    onClick={() => setEditingDay(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveEditDay}
                                    disabled={savingShift}
                                    className="px-5 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {savingShift && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
