'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileSpreadsheet,
    Mail,
    ShieldAlert,
    Truck,
    Droplet,
    Clock,
    Disc,
    UserMinus,
    Palmtree,
    TrendingUp,
    Wrench,
    RefreshCw,
    Send,
    ExternalLink,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import DataTable, { DataTableColumn } from '@/components/ui/DataTable';
import { downloadExcelWorkbook } from '@/lib/excel';
import { toast } from 'sonner';

type ReportKey =
    | 'vencimientos'
    | 'costeKm'
    | 'consumo'
    | 'horasExtra'
    | 'tacografoInfracciones'
    | 'absentismo'
    | 'vacaciones'
    | 'productividad'
    | 'mantenimientoMttr';

const REPORT_DEFS: Array<{
    key: ReportKey;
    title: string;
    shortTitle: string;
    subtitle: string;
    icon: any;
    color: string;
}> = [
    {
        key: 'vencimientos',
        title: '1. Vencimientos a 30, 60 y 90 días (ITV, ADR, Tacógrafo, Carnets, Seguros)',
        shortTitle: 'Vencimientos (30/60/90d)',
        subtitle: 'Control preventivo de caducidades documentales de flota y conductores.',
        icon: ShieldAlert,
        color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
        key: 'costeKm',
        title: '2. Coste por KM y por Camión (Combustible + Taller + Recambios)',
        shortTitle: 'Coste por KM y Camión',
        subtitle: 'Rentabilidad por vehículo para detectar camiones caros y planificar su renovación.',
        icon: Truck,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
        key: 'consumo',
        title: '3. Consumo de Combustible (L/100 km por Camión y Conductor)',
        shortTitle: 'Consumo (L/100km)',
        subtitle: 'Detección de desvíos y consumos anómalos a partir de los repostajes reales.',
        icon: Droplet,
        color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
        key: 'horasExtra',
        title: '4. Horas Extra y Cumplimiento de Jornada',
        shortTitle: 'Horas Extra y Jornada',
        subtitle: 'Control legal de horas ordinarias, exceso de jornada, retrasos y días sin cerrar.',
        icon: Clock,
        color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
        key: 'tacografoInfracciones',
        title: '5. Infracciones de Tacógrafo por Conductor (Tendencia CE 561/2006)',
        shortTitle: 'Infracciones Tacógrafo',
        subtitle: 'Prevención de sanciones en carretera y detección de necesidades de formación.',
        icon: Disc,
        color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
        key: 'absentismo',
        title: '6. Absentismo (Tasa por Empleado, Bajas y Permisos)',
        shortTitle: 'Tasa de Absentismo',
        subtitle: 'Indicadores de RRHH sobre bajas médicas, permisos retribuidos y ausencias.',
        icon: UserMinus,
        color: 'text-orange-600 bg-orange-50 border-orange-200',
    },
    {
        key: 'vacaciones',
        title: '7. Saldo de Vacaciones Pendientes por Empleado',
        shortTitle: 'Saldo de Vacaciones',
        subtitle: 'Control de días disfrutados, solicitados y pendientes para evitar acumulaciones a fin de año.',
        icon: Palmtree,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
        key: 'productividad',
        title: '8. Productividad por Conductor (KM, Viajes y Descargas por Jornada)',
        shortTitle: 'Productividad Conductor',
        subtitle: 'Base objetiva de rendimiento operativo diario para el cálculo de incentivos.',
        icon: TrendingUp,
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    },
    {
        key: 'mantenimientoMttr',
        title: '9. Mantenimiento Preventivo vs Correctivo y Tiempo Medio de Reparación (MTTR)',
        shortTitle: 'Taller y MTTR',
        subtitle: 'Eficacia del taller, proporción preventivo/correctivo y horas de inmovilización.',
        icon: Wrench,
        color: 'text-slate-700 bg-slate-100 border-slate-300',
    },
];

function CentroInformesContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialReport = (searchParams.get('report') as ReportKey) || 'vencimientos';

    const now = new Date();
    const [activeReport, setActiveReport] = useState<ReportKey>(
        REPORT_DEFS.some((r) => r.key === initialReport) ? initialReport : 'vencimientos'
    );
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);

    // Modal de Envío por Email (Gestoría / Dirección)
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [tipoEnvio, setTipoEnvio] = useState<'MENSUAL_GESTORIA' | 'SEMANAL_DIRECCION'>('MENSUAL_GESTORIA');
    const [destinatarioEmail, setDestinatarioEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/informes/centro?year=${year}&month=${month}`);
            if (res.ok) {
                setData(await res.json());
            } else {
                toast.error('Error al cargar el Centro de Informes');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error de conexión cargando informes');
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleSelectReport = (key: ReportKey) => {
        setActiveReport(key);
        const params = new URLSearchParams(searchParams.toString());
        params.set('report', key);
        router.replace(`/admin/informes/centro?${params.toString()}`, { scroll: false });
    };

    const handleDownloadAllWorkbook = () => {
        if (!data?.reports) return;
        const r = data.reports;
        downloadExcelWorkbook(`Centro_Informes_SEL_${year}_${String(month).padStart(2, '0')}.xlsx`, [
            {
                name: '1_Vencimientos',
                headers: ['Categoría', 'Titular', 'Documento', 'Fecha Caducidad', 'Días Restantes', 'Plazo'],
                rows: (r.vencimientos || []).map((x: any) => [
                    x.categoria,
                    x.titular,
                    x.documento,
                    x.fechaCaducidad,
                    x.diasRestantes,
                    x.plazo,
                ]),
            },
            {
                name: '2_Coste_KM',
                headers: ['Matrícula', 'Modelo', 'KM Período', 'Litros', 'Coste Combustible (€)', 'Coste Taller (€)', 'Coste Total (€)', '€/KM', 'Estado'],
                rows: (r.costeKm || []).map((x: any) => [
                    x.matricula,
                    x.modelo,
                    x.kmPeriodo,
                    x.litrosRepostados,
                    x.costeCombustible,
                    x.costeTallerTotal,
                    x.costeTotal,
                    x.eurPorKm,
                    x.estadoRentabilidad,
                ]),
            },
            {
                name: '3_Consumo_L100',
                headers: ['Tipo', 'Vehículo / Conductor', 'Detalle', 'KM Recorridos', 'Litros Repostados', 'Consumo (L/100km)', 'Desviación', 'Estado'],
                rows: (r.consumo || []).map((x: any) => [
                    x.tipo,
                    x.nombre,
                    x.subtitulo,
                    x.kmRecorridos,
                    x.litrosRepostados,
                    x.l100km,
                    x.desviacion,
                    x.estadoConsumo,
                ]),
            },
            {
                name: '4_Horas_Extra',
                headers: ['Empleado', 'Rol', 'Días Trabajados', 'Horas Totales', 'Horas Ordinarias', 'Horas Extra', 'Media h/día', 'Sin Cerrar', 'Cumplimiento %'],
                rows: (r.horasExtra || []).map((x: any) => [
                    x.empleado,
                    x.rol,
                    x.diasTrabajados,
                    x.horasTrabajadas,
                    x.horasOrdinarias,
                    x.horasExtraPeriodo,
                    x.mediaHorasDia,
                    x.jornadasSinCerrar,
                    x.cumplimientoPct,
                ]),
            },
            {
                name: '5_Tacografo',
                headers: ['Conductor', 'Tarjeta', 'Leves', 'Graves', 'Muy Graves', 'Total Infracciones', 'Exceso Conducción', 'Falta Descanso', 'Acción Recomendada'],
                rows: (r.tacografoInfracciones || []).map((x: any) => [
                    x.conductor,
                    x.tarjetaVinculada,
                    x.leves,
                    x.graves,
                    x.muyGraves,
                    x.totalInfracciones,
                    x.excesoConduccion,
                    x.faltaDescanso,
                    x.accionRecomendada,
                ]),
            },
            {
                name: '6_Absentismo',
                headers: ['Empleado', 'Rol', 'Días Laborables', 'Días Baja', 'Días Permiso', 'Días Vacaciones', 'Total Ausencia No Vac.', 'Tasa Absentismo (%)'],
                rows: (r.absentismo || []).map((x: any) => [
                    x.empleado,
                    x.rol,
                    x.diasLaborablesBase,
                    x.diasBaja,
                    x.diasPermiso,
                    x.diasVacaciones,
                    x.diasAusenciaNoVacacional,
                    x.tasaAbsentismoPct,
                ]),
            },
            {
                name: '7_Vacaciones',
                headers: ['Empleado', 'Rol', 'Cupo Anual', 'Disfrutadas', 'Pendientes Aprobar', 'Saldo Disponible', 'Estado'],
                rows: (r.vacaciones || []).map((x: any) => [
                    x.empleado,
                    x.rol,
                    x.cupoTotal,
                    x.diasDisfrutados,
                    x.diasSolicitadosPendientes,
                    x.saldoPendiente,
                    x.alertaAcumulacion,
                ]),
            },
            {
                name: '8_Productividad',
                headers: ['Conductor', 'Jornadas', 'KM Totales', 'KM/Jornada', 'Viajes Totales', 'Viajes/Jornada', 'Descargas Totales', 'Descargas/Jornada', 'Puntos Incentivo'],
                rows: (r.productividad || []).map((x: any) => [
                    x.conductor,
                    x.jornadasTrabajadas,
                    x.kmTotales,
                    x.kmPorJornada,
                    x.viajesTotales,
                    x.viajesPorJornada,
                    x.descargasTotales,
                    x.descargasPorJornada,
                    x.scoreIncentivo,
                ]),
            },
            {
                name: '9_Taller_MTTR',
                headers: ['Matrícula', 'Modelo', 'Preventivos', 'Correctivos', 'Total Intervenciones', '% Preventivo', 'MTTR (Horas)', 'Horas Inmovilizado'],
                rows: (r.mantenimientoMttr || []).map((x: any) => [
                    x.matricula,
                    x.modelo,
                    x.preventivos,
                    x.correctivos,
                    x.totalIntervenciones,
                    x.ratioPreventivoPct,
                    x.mttrHoras,
                    x.inmovilizadoHoras,
                ]),
            },
        ]);
        toast.success('Libro Excel completo (9 hojas) descargado correctamente');
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!destinatarioEmail) {
            toast.error('Introduce un correo electrónico de destino');
            return;
        }
        setSendingEmail(true);
        try {
            const res = await fetch('/api/admin/informes/centro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipoEnvio,
                    destinatarioEmail,
                    year,
                    month,
                    resumenDatos: data?.resumenGlobal,
                }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success(json.mensaje || 'Informe enviado correctamente');
                setShowEmailModal(false);
            } else {
                toast.error(json.error || 'No se pudo enviar el informe');
            }
        } finally {
            setSendingEmail(false);
        }
    };

    const currentDef = REPORT_DEFS.find((d) => d.key === activeReport) || REPORT_DEFS[0];
    const reports = data?.reports || {};
    const resumen = data?.resumenGlobal || {};

    return (
        <div className="space-y-6">
            {/* CABECERA EJECUTIVA */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-blue-100 text-blue-800">
                            Centro de Inteligencia Operativa y RRHH
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mt-1">
                        Centro de Informes (9 KPIs Clave)
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Vencimientos a 30/60/90 días, coste por KM, consumo L/100km, horas extra, tacógrafo, absentismo, vacaciones, productividad y MTTR de taller.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="bg-white px-3 py-1.5 rounded-lg text-xs font-black text-slate-800 border border-slate-200"
                        >
                            {[
                                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
                            ].map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="bg-white px-3 py-1.5 rounded-lg text-xs font-black text-slate-800 border border-slate-200"
                        >
                            {[2024, 2025, 2026, 2027].map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={fetchReports}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                            title="Actualizar datos"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                        </button>
                    </div>

                    <Button
                        onClick={handleDownloadAllWorkbook}
                        disabled={loading || !data}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-10 px-4 rounded-xl flex items-center gap-2 shadow-sm"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Descargar Libro Completo (9 Hojas .xlsx)
                    </Button>

                    <Button
                        onClick={() => setShowEmailModal(true)}
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 font-black text-xs h-10 px-4 rounded-xl flex items-center gap-2"
                    >
                        <Mail className="w-4 h-4" />
                        Enviar a Gestoría / Dirección
                    </Button>
                </div>
            </div>

            {/* TARJETAS KPI RESUMEN GLOBAL */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => handleSelectReport('vencimientos')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-rose-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">Vencimientos ≤30d</p>
                    <p className={`text-2xl font-black mt-1 ${(resumen.vencimientosCriticos || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {resumen.vencimientosCriticos ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ITV, ADR, Carnets</p>
                </div>

                <div
                    onClick={() => handleSelectReport('costeKm')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">Coste Operativo Flota</p>
                    <p className="text-2xl font-black text-indigo-700 mt-1">
                        {(resumen.costeFlotaTotal ?? 0).toLocaleString()} €
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Gasoil est. + Taller</p>
                </div>

                <div
                    onClick={() => handleSelectReport('productividad')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-cyan-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">KM Totales Período</p>
                    <p className="text-2xl font-black text-cyan-700 mt-1">
                        {(resumen.kmTotalesPeriodo ?? 0).toLocaleString()} km
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Flota en ruta</p>
                </div>

                <div
                    onClick={() => handleSelectReport('horasExtra')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">Horas Extra Mes</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">
                        {resumen.horasExtraTotales ?? 0} h
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Sobre 8h/jornada</p>
                </div>

                <div
                    onClick={() => handleSelectReport('tacografoInfracciones')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-purple-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">Incidencias Tacógrafo</p>
                    <p className="text-2xl font-black text-purple-700 mt-1">
                        {resumen.infraccionesTacografo ?? 0}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Reglamento CE 561</p>
                </div>

                <div
                    onClick={() => handleSelectReport('vacaciones')}
                    className="cursor-pointer bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-sm"
                >
                    <p className="text-[10px] font-black uppercase text-slate-400">Vacaciones Pendientes</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                        {resumen.vacacionesPendientesTotal ?? 0} d
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Saldo plantilla {year}</p>
                </div>
            </div>

            {/* SELECTOR DE LOS 9 INFORMES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-2">
                {REPORT_DEFS.map((item) => {
                    const Icon = item.icon;
                    const active = activeReport === item.key;
                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSelectReport(item.key)}
                            className={`flex flex-col items-start justify-between p-3 rounded-xl border text-left transition-all ${
                                active
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.01]'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-blue-400' : 'text-slate-500'}`} />
                            <span className="text-[11px] font-black leading-tight">{item.shortTitle}</span>
                        </button>
                    );
                })}
            </div>

            {/* TABLA DEL INFORME SELECCIONADO */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                        <h2 className="text-base font-black text-slate-900">{currentDef.title}</h2>
                        <p className="text-xs text-slate-500">{currentDef.subtitle}</p>
                    </div>
                </div>

                {activeReport === 'vencimientos' && (
                    <DataTable
                        data={reports.vencimientos || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Vencimientos_${year}_${month}`}
                        searchPlaceholder="Buscar por matrícula, conductor o documento (ITV, ADR, Carnet...)"
                        filters={[
                            {
                                key: 'plazo',
                                label: 'Plazo de Aviso',
                                options: [
                                    { value: 'CADUCADO', label: '🔴 Caducado (< 0 días)' },
                                    { value: '30_DIAS', label: '🟠 A 30 días' },
                                    { value: '60_DIAS', label: '🟡 A 60 días' },
                                    { value: '90_DIAS', label: '🔵 A 90 días' },
                                ],
                            },
                            {
                                key: 'categoria',
                                label: 'Categoría',
                                options: [
                                    { value: 'VEHICULO', label: '🚛 Vehículo / Cisterna' },
                                    { value: 'EMPLEADO', label: '👤 Conductor / Empleado' },
                                ],
                            },
                        ]}
                        columns={[
                            { key: 'categoria', header: 'Tipo', sortable: true },
                            { key: 'titular', header: 'Vehículo / Empleado', sortable: true },
                            { key: 'documento', header: 'Documento', sortable: true },
                            { key: 'fechaCaducidad', header: 'Fecha Caducidad', sortable: true },
                            {
                                key: 'diasRestantes',
                                header: 'Días Restantes',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => (
                                    <span className={`font-black ${r.diasRestantes < 0 ? 'text-rose-600' : r.diasRestantes <= 30 ? 'text-amber-600' : 'text-slate-700'}`}>
                                        {r.diasRestantes} días
                                    </span>
                                ),
                            },
                            {
                                key: 'plazo',
                                header: 'Urgencia',
                                sortable: true,
                                render: (r: any) => {
                                    const badge =
                                        r.plazo === 'CADUCADO'
                                            ? 'bg-rose-100 text-rose-800'
                                            : r.plazo === '30_DIAS'
                                                ? 'bg-orange-100 text-orange-800'
                                                : r.plazo === '60_DIAS'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-blue-100 text-blue-800';
                                    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${badge}`}>{r.plazo.replace('_', ' ')}</span>;
                                },
                            },
                            {
                                key: 'accion',
                                header: 'Ficha 360°',
                                align: 'right',
                                render: (r: any) => (
                                    <Link href={r.href} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                                        Abrir ficha <ExternalLink className="w-3 h-3" />
                                    </Link>
                                ),
                            },
                        ]}
                    />
                )}

                {activeReport === 'costeKm' && (
                    <DataTable
                        data={reports.costeKm || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Coste_KM_${year}_${month}`}
                        searchPlaceholder="Buscar matrícula o modelo..."
                        filters={[
                            {
                                key: 'estadoRentabilidad',
                                label: 'Recomendación',
                                options: [
                                    { value: 'ÓPTIMO', label: '🟢 Óptimo' },
                                    { value: 'VIGILAR COSTE', label: '🟡 Vigilar Coste' },
                                    { value: 'EVALUAR RENOVACIÓN', label: '🔴 Evaluar Renovación' },
                                ],
                            },
                        ]}
                        columns={[
                            {
                                key: 'matricula',
                                header: 'Camión',
                                sortable: true,
                                render: (r: any) => (
                                    <Link href={`/admin/camiones/${r.id}`} className="font-black text-indigo-700 hover:underline">
                                        {r.matricula}
                                    </Link>
                                ),
                            },
                            { key: 'modelo', header: 'Modelo', sortable: true },
                            { key: 'kmPeriodo', header: 'KM Período', sortable: true, align: 'right' },
                            { key: 'litrosRepostados', header: 'Litros Gasoil', sortable: true, align: 'right' },
                            {
                                key: 'costeCombustible',
                                header: 'Combustible (€)',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => `${r.costeCombustible.toLocaleString()} €`,
                            },
                            {
                                key: 'costeTallerTotal',
                                header: 'Taller / Recambios (€)',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => `${r.costeTallerTotal.toLocaleString()} €`,
                            },
                            {
                                key: 'costeTotal',
                                header: 'Coste Total (€)',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-black text-slate-900">{r.costeTotal.toLocaleString()} €</span>,
                            },
                            {
                                key: 'eurPorKm',
                                header: 'Coste €/KM',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-mono font-black text-indigo-700">{r.eurPorKm} €/km</span>,
                            },
                            {
                                key: 'estadoRentabilidad',
                                header: 'Diagnóstico',
                                sortable: true,
                                render: (r: any) => (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            r.estadoRentabilidad === 'EVALUAR RENOVACIÓN'
                                                ? 'bg-rose-100 text-rose-800'
                                                : r.estadoRentabilidad === 'VIGILAR COSTE'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                    >
                                        {r.estadoRentabilidad}
                                    </span>
                                ),
                            },
                        ]}
                    />
                )}

                {activeReport === 'consumo' && (
                    <DataTable
                        data={reports.consumo || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Consumo_Combustible_${year}_${month}`}
                        searchPlaceholder="Buscar camión o conductor..."
                        filters={[
                            {
                                key: 'tipo',
                                label: 'Agrupación',
                                options: [
                                    { value: 'CAMIÓN', label: '🚛 Por Camión' },
                                    { value: 'CONDUCTOR', label: '👤 Por Conductor' },
                                ],
                            },
                            {
                                key: 'estadoConsumo',
                                label: 'Nivel Consumo',
                                options: [
                                    { value: 'NORMAL', label: '🟢 Normal' },
                                    { value: 'CONSUMO ELEVADO', label: '🟠 Consumo Elevado' },
                                    { value: 'DESVÍO ALTO', label: '🔴 Desvío Alto (>42 L/100)' },
                                ],
                            },
                        ]}
                        columns={[
                            { key: 'tipo', header: 'Tipo', sortable: true },
                            { key: 'nombre', header: 'Camión / Conductor', sortable: true },
                            { key: 'kmRecorridos', header: 'KM Recorridos', sortable: true, align: 'right' },
                            { key: 'litrosRepostados', header: 'Litros Repostados', sortable: true, align: 'right' },
                            {
                                key: 'l100km',
                                header: 'Media L/100km',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-mono font-black text-amber-700">{r.l100km} L/100km</span>,
                            },
                            {
                                key: 'desviacion',
                                header: 'Desvío s/32L',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => (
                                    <span className={r.desviacion > 3 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                                        {r.desviacion > 0 ? `+${r.desviacion}` : r.desviacion} L
                                    </span>
                                ),
                            },
                            { key: 'estadoConsumo', header: 'Diagnóstico', sortable: true },
                        ]}
                    />
                )}

                {activeReport === 'horasExtra' && (
                    <DataTable
                        data={reports.horasExtra || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Horas_Extra_${year}_${month}`}
                        searchPlaceholder="Buscar empleado..."
                        columns={[
                            {
                                key: 'empleado',
                                header: 'Empleado',
                                sortable: true,
                                render: (r: any) => (
                                    <Link href={`/admin/empleados/${r.id}`} className="font-bold text-blue-600 hover:underline">
                                        {r.empleado}
                                    </Link>
                                ),
                            },
                            { key: 'rol', header: 'Rol', sortable: true },
                            { key: 'diasTrabajados', header: 'Jornadas', sortable: true, align: 'right' },
                            { key: 'horasTrabajadas', header: 'Horas Totales', sortable: true, align: 'right' },
                            { key: 'horasOrdinarias', header: 'Horas Ord. (8h)', sortable: true, align: 'right' },
                            {
                                key: 'horasExtraPeriodo',
                                header: 'Horas Extra',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => (
                                    <span className={`font-black ${r.horasExtraPeriodo > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                                        +{r.horasExtraPeriodo} h
                                    </span>
                                ),
                            },
                            { key: 'mediaHorasDia', header: 'Media h/día', sortable: true, align: 'right' },
                            { key: 'jornadasSinCerrar', header: 'Sin Cerrar', sortable: true, align: 'right' },
                            {
                                key: 'cumplimientoPct',
                                header: 'Cumplimiento',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => `${r.cumplimientoPct}%`,
                            },
                        ]}
                    />
                )}

                {activeReport === 'tacografoInfracciones' && (
                    <DataTable
                        data={reports.tacografoInfracciones || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Infracciones_Tacografo_${year}_${month}`}
                        searchPlaceholder="Buscar conductor o tarjeta..."
                        columns={[
                            {
                                key: 'conductor',
                                header: 'Conductor',
                                sortable: true,
                                render: (r: any) => (
                                    <Link href={`/admin/empleados/${r.id}`} className="font-bold text-purple-700 hover:underline">
                                        {r.conductor}
                                    </Link>
                                ),
                            },
                            { key: 'tarjetaVinculada', header: 'Tarjeta Tacógrafo', sortable: true },
                            { key: 'leves', header: 'Leves', sortable: true, align: 'right' },
                            { key: 'graves', header: 'Graves', sortable: true, align: 'right' },
                            {
                                key: 'muyGraves',
                                header: 'Muy Graves',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => (
                                    <span className={r.muyGraves > 0 ? 'font-black text-rose-600' : 'text-slate-400'}>
                                        {r.muyGraves}
                                    </span>
                                ),
                            },
                            {
                                key: 'totalInfracciones',
                                header: 'Total',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-black">{r.totalInfracciones}</span>,
                            },
                            { key: 'accionRecomendada', header: 'Plan de Acción / Formación', sortable: true },
                        ]}
                    />
                )}

                {activeReport === 'absentismo' && (
                    <DataTable
                        data={reports.absentismo || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Absentismo_${year}_${month}`}
                        searchPlaceholder="Buscar empleado..."
                        columns={[
                            { key: 'empleado', header: 'Empleado', sortable: true },
                            { key: 'rol', header: 'Rol', sortable: true },
                            { key: 'diasLaborablesBase', header: 'Días Hábiles', sortable: true, align: 'right' },
                            { key: 'diasBaja', header: 'Baja Médica (IT)', sortable: true, align: 'right' },
                            { key: 'diasPermiso', header: 'Permisos', sortable: true, align: 'right' },
                            { key: 'diasVacaciones', header: 'Vacaciones', sortable: true, align: 'right' },
                            {
                                key: 'tasaAbsentismoPct',
                                header: 'Tasa Absentismo',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => (
                                    <span className={`font-black ${r.tasaAbsentismoPct > 10 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                        {r.tasaAbsentismoPct}%
                                    </span>
                                ),
                            },
                        ]}
                    />
                )}

                {activeReport === 'vacaciones' && (
                    <DataTable
                        data={reports.vacaciones || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Saldo_Vacaciones_${year}`}
                        searchPlaceholder="Buscar empleado..."
                        columns={[
                            { key: 'empleado', header: 'Empleado', sortable: true },
                            { key: 'rol', header: 'Rol', sortable: true },
                            { key: 'cupoTotal', header: 'Cupo Anual', sortable: true, align: 'right' },
                            { key: 'diasDisfrutados', header: 'Disfrutados', sortable: true, align: 'right' },
                            { key: 'diasSolicitadosPendientes', header: 'Solicitados (Pend.)', sortable: true, align: 'right' },
                            {
                                key: 'saldoPendiente',
                                header: 'Saldo Pendiente',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-black text-emerald-700">{r.saldoPendiente} días</span>,
                            },
                            { key: 'alertaAcumulacion', header: 'Estado Planificación', sortable: true },
                        ]}
                    />
                )}

                {activeReport === 'productividad' && (
                    <DataTable
                        data={reports.productividad || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Productividad_Conductores_${year}_${month}`}
                        searchPlaceholder="Buscar conductor..."
                        columns={[
                            {
                                key: 'conductor',
                                header: 'Conductor',
                                sortable: true,
                                render: (r: any) => (
                                    <Link href={`/admin/empleados/${r.id}`} className="font-bold text-cyan-700 hover:underline">
                                        {r.conductor}
                                    </Link>
                                ),
                            },
                            { key: 'jornadasTrabajadas', header: 'Jornadas', sortable: true, align: 'right' },
                            { key: 'kmTotales', header: 'KM Totales', sortable: true, align: 'right' },
                            { key: 'kmPorJornada', header: 'KM / Jornada', sortable: true, align: 'right' },
                            { key: 'viajesTotales', header: 'Viajes', sortable: true, align: 'right' },
                            { key: 'viajesPorJornada', header: 'Viajes / Día', sortable: true, align: 'right' },
                            { key: 'descargasTotales', header: 'Descargas', sortable: true, align: 'right' },
                            { key: 'descargasPorJornada', header: 'Descargas / Día', sortable: true, align: 'right' },
                            {
                                key: 'scoreIncentivo',
                                header: 'Índice Productividad',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-black text-indigo-700">{r.scoreIncentivo} pts</span>,
                            },
                        ]}
                    />
                )}

                {activeReport === 'mantenimientoMttr' && (
                    <DataTable
                        data={reports.mantenimientoMttr || []}
                        loading={loading}
                        rowKey={(r: any) => r.id}
                        exportFilename={`Informe_Mantenimiento_MTTR_${year}_${month}`}
                        searchPlaceholder="Buscar matrícula o modelo..."
                        columns={[
                            {
                                key: 'matricula',
                                header: 'Camión',
                                sortable: true,
                                render: (r: any) => (
                                    <Link href={`/admin/camiones/${r.id}`} className="font-black text-slate-900 hover:underline">
                                        {r.matricula}
                                    </Link>
                                ),
                            },
                            { key: 'modelo', header: 'Modelo', sortable: true },
                            { key: 'preventivos', header: 'Preventivos', sortable: true, align: 'right' },
                            { key: 'correctivos', header: 'Correctivos / Averías', sortable: true, align: 'right' },
                            {
                                key: 'ratioPreventivoPct',
                                header: '% Preventivo',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => `${r.ratioPreventivoPct}%`,
                            },
                            {
                                key: 'mttrHoras',
                                header: 'MTTR (Tiempo Medio Reparación)',
                                sortable: true,
                                align: 'right',
                                render: (r: any) => <span className="font-mono font-bold">{r.mttrHoras} h</span>,
                            },
                            { key: 'inmovilizadoHoras', header: 'Horas Inmovilizado', sortable: true, align: 'right' },
                        ]}
                    />
                )}
            </div>

            {/* MODAL ENVÍO AUTOMÁTICO POR EMAIL (GESTORÍA / DIRECCIÓN) */}
            {showEmailModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="bg-slate-900 text-white p-5">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <Mail className="w-5 h-5 text-blue-400" />
                                Envío de Informes por Email
                            </h3>
                            <p className="text-xs text-slate-300 mt-1">
                                Envía el cierre mensual a la Gestoría o el resumen ejecutivo a Dirección y regístralo en auditoría.
                            </p>
                        </div>

                        <form onSubmit={handleSendEmail} className="p-5 space-y-4">
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase text-slate-600">Tipo de Resumen</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTipoEnvio('MENSUAL_GESTORIA')}
                                        className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                                            tipoEnvio === 'MENSUAL_GESTORIA'
                                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                : 'border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        📋 Cierre Mensual Gestoría (Nóminas y Variables)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipoEnvio('SEMANAL_DIRECCION')}
                                        className={`p-3 rounded-xl border text-left text-xs font-bold transition-all ${
                                            tipoEnvio === 'SEMANAL_DIRECCION'
                                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                                : 'border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        📊 Resumen Ejecutivo Dirección (Flota y KPIs)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase text-slate-600">
                                    Email Destinatario
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder="gestoria@ejemplo.com o direccion@seltrans.com"
                                    value={destinatarioEmail}
                                    onChange={(e) => setDestinatarioEmail(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Datos incluidos en el envío ({month}/{year}):
                                </div>
                                <p>• KM Totales: {(resumen.kmTotalesPeriodo || 0).toLocaleString()} km</p>
                                <p>• Horas Extra: {resumen.horasExtraTotales || 0} h</p>
                                <p>• Coste Flota: {(resumen.costeFlotaTotal || 0).toLocaleString()} €</p>
                                <p>• Vencimientos ≤30 días: {resumen.vencimientosCriticos || 0}</p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setShowEmailModal(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={sendingEmail}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    {sendingEmail ? 'Enviando...' : 'Enviar Informe'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CentroInformesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando Centro de Informes...</div>}>
            <CentroInformesContent />
        </Suspense>
    );
}
