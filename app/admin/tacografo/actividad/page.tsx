'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CalendarDays, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Filter } from 'lucide-react';

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRIVING: { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Conducción' },
  OTHER_WORK: { bg: 'bg-purple-500', text: 'text-purple-700', label: 'Otros trabajos' },
  AVAILABILITY: { bg: 'bg-cyan-500', text: 'text-cyan-700', label: 'Disponibilidad' },
  REST: { bg: 'bg-green-500', text: 'text-green-700', label: 'Descanso' },
  BREAK: { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Pausa' },
  UNKNOWN: { bg: 'bg-gray-400', text: 'text-gray-600', label: 'Desconocido' },
};

// Estado a nivel de EVENTO (consolidationStatus de NormalizedEvent)
const EVENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  operative: { label: 'Operativo', color: 'text-green-700 bg-green-50' },
  provisional: { label: 'Provisional', color: 'text-amber-700 bg-amber-50' },
  excluded: { label: 'Excluido', color: 'text-red-700 bg-red-50' },
};

// Estado a nivel de DÍA (dayConsolidationStatus de DailySummary — FUENTE DE VERDAD)
const DAY_STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  VALID: { label: 'Válido', color: 'text-green-700 bg-green-50 border-green-200', icon: '✅' },
  BLOCKED_NO_SOURCE: { label: 'Sin datos origen', color: 'text-red-700 bg-red-50 border-red-200', icon: '🚫' },
  BLOCKED_LOW_CONFIDENCE: { label: 'Baja confianza', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: '⚠️' },
  BLOCKED_CONFLICT: { label: 'Conflicto', color: 'text-red-700 bg-red-50 border-red-200', icon: '❌' },
  // Fallback para datos legacy que aún no tengan DailySummary
  UNKNOWN: { label: 'Sin resumen', color: 'text-gray-500 bg-gray-50 border-gray-200', icon: '❓' },
};

const CONFIDENCE_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'Alta', color: 'text-green-700' },
  medium: { label: 'Media', color: 'text-amber-700' },
  low: { label: 'Baja', color: 'text-red-700' },
};

const WORK_TYPES = ['DRIVING', 'OTHER_WORK', 'AVAILABILITY'];
const REST_TYPES = ['REST', 'BREAK'];

interface JornadaSummary {
  date: string;              // YYYY-MM-DD estable del backend
  driverName: string;
  driverId: number | null;
  vehiclePlates: string[];
  inicioJornada: string | null;
  inicioComida: string | null;
  finComida: string | null;
  finJornada: string | null;
  totalDriving: number;
  totalOtherWork: number;
  totalAvailability: number;
  totalRest: number;
  totalBreak: number;
  totalWork: number;
  averageConfidence: string;
  // Estado del DÍA — viene de TachographDailySummary (FUENTE DE VERDAD)
  dayStatus: string;           // dayConsolidationStatus
  rawEventsCount: number;
  ownSourceMinutes: number;
  inheritedSplitMinutes: number;
  gapMinutes: number;
  consistencyStatus: string;
  // Estado de los EVENTOS — deducido de NormalizedEvent (solo informativo)
  eventsConsolidationStatus: string;
  activities: any[];
}

/**
 * Formatea una hora local del servidor (ya es hora España) como HH:mm
 * El servidor envía startAtLocal/endAtLocal como UTC-encoded local times
 */
function formatLocalTime(isoString: string | null): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Fallback: convierte UTC a España usando toLocaleString (para legacy data sin startAtLocal)
 */
function toSpainTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

function calcJornada(activities: any[]): {
  inicioJornada: string | null;
  inicioComida: string | null;
  finComida: string | null;
  finJornada: string | null;
} {
  if (!activities.length) return { inicioJornada: null, inicioComida: null, finComida: null, finJornada: null };

  // Usar startAtLocal si está disponible, si no fallback a startTime
  const getLocalStart = (a: any) => a.startAtLocal || a.startTime;
  const getLocalEnd = (a: any) => a.endAtLocal || a.endTime;
  const getType = (a: any) => a.activityType;

  const sorted = [...activities].sort(
    (a, b) => new Date(getLocalStart(a)).getTime() - new Date(getLocalStart(b)).getTime()
  );

  let inicioJornada: string | null = null;
  for (const act of sorted) {
    if (WORK_TYPES.includes(getType(act))) {
      inicioJornada = getLocalStart(act);
      break;
    }
  }

  let finJornada: string | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (['DRIVING', 'OTHER_WORK'].includes(getType(sorted[i]))) {
      finJornada = getLocalEnd(sorted[i]);
      break;
    }
  }

  let inicioComida: string | null = null;
  let finComida: string | null = null;
  let maxRestMinutes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    if (!REST_TYPES.includes(getType(act))) continue;

    const restMins = act.durationMinutes || 0;
    const hasWorkBefore = sorted.slice(0, i).some((a: any) => WORK_TYPES.includes(getType(a)));
    const hasWorkAfter = sorted.slice(i + 1).some((a: any) => WORK_TYPES.includes(getType(a)));

    if (hasWorkBefore && hasWorkAfter) {
      let cumulativeEnd = getLocalEnd(act);
      let cumulativeMins = restMins;
      for (let j = i + 1; j < sorted.length; j++) {
        if (REST_TYPES.includes(getType(sorted[j]))) {
          const nextStart = new Date(getLocalStart(sorted[j]));
          const prevEnd = new Date(cumulativeEnd);
          const gap = (nextStart.getTime() - prevEnd.getTime()) / 60000;
          if (gap <= 5) {
            cumulativeEnd = getLocalEnd(sorted[j]);
            cumulativeMins += sorted[j].durationMinutes || 0;
          } else break;
        } else break;
      }
      if (cumulativeMins > maxRestMinutes) {
        maxRestMinutes = cumulativeMins;
        inicioComida = getLocalStart(act);
        finComida = cumulativeEnd;
      }
    }
  }

  return { inicioJornada, inicioComida, finComida, finJornada };
}

export default function ActividadPage() {
  const [daySummaries, setDaySummaries] = useState<JornadaSummary[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedConsolidation, setSelectedConsolidation] = useState('');
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return {
      from: monthAgo.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1000' });
      if (selectedDriver) params.set('driverId', selectedDriver);
      if (dateRange.from) params.set('dateFrom', dateRange.from);
      if (dateRange.to) params.set('dateTo', dateRange.to);
      if (selectedConsolidation) params.set('consolidationStatus', selectedConsolidation);

      const [actRes, drvRes] = await Promise.all([
        fetch(`/api/tacografo/activities?${params}`),
        fetch('/api/tacografo/drivers')
      ]);

      let actData: any[] = [];
      let summariesData: any[] = [];
      if (actRes.ok) {
        const json = await actRes.json();
        actData = json.data || [];
        summariesData = json.dailySummaries || [];
      }
      if (drvRes.ok) setDrivers(await drvRes.json());

      // Indexar DailySummary por dateKey_driverId (FUENTE DE VERDAD del estado del día)
      const summaryMap = new Map<string, any>();
      for (const s of summariesData) {
        const key = `${s.dateKey}_${s.driverId}`;
        summaryMap.set(key, s);
      }

      // Agrupar actividades por día operativo + conductor
      // Usar dateKey estable del backend (YYYY-MM-DD, sin reconstrucción con toISOString)
      const byDay = new Map<string, JornadaSummary>();
      for (const act of actData) {
        const dayKey = act.dateKey; // clave estable del backend

        const driverId = act.driverId;
        const driverName = act.driver?.linkedEmployee
          ? `${act.driver.linkedEmployee.nombre} ${act.driver.linkedEmployee.apellidos || ''}`.trim()
          : act.driver?.fullName || 'Desconocido';
        const compositeKey = `${dayKey}_${driverId || 'none'}`;

        if (!byDay.has(compositeKey)) {
          byDay.set(compositeKey, {
            date: dayKey,
            driverName,
            driverId,
            vehiclePlates: [],
            inicioJornada: null, inicioComida: null, finComida: null, finJornada: null,
            totalDriving: 0, totalOtherWork: 0, totalAvailability: 0,
            totalRest: 0, totalBreak: 0, totalWork: 0,
            averageConfidence: 'medium',
            dayStatus: 'UNKNOWN',
            rawEventsCount: 0,
            ownSourceMinutes: 0,
            inheritedSplitMinutes: 0,
            gapMinutes: 0,
            consistencyStatus: 'ok',
            eventsConsolidationStatus: 'provisional',
            activities: [],
          });
        }
        const ds = byDay.get(compositeKey)!;
        const mins = act.durationMinutes || 0;
        switch (act.activityType) {
          case 'DRIVING': ds.totalDriving += mins; break;
          case 'OTHER_WORK': ds.totalOtherWork += mins; break;
          case 'AVAILABILITY': ds.totalAvailability += mins; break;
          case 'REST': ds.totalRest += mins; break;
          case 'BREAK': ds.totalBreak += mins; break;
        }

        // Recopilar vehículos del día
        const plate = act.vehicle?.plateNumber || act.vehicle?.linkedVehicle?.matricula;
        if (plate && !ds.vehiclePlates.includes(plate)) {
          ds.vehiclePlates.push(plate);
        }

        ds.activities.push(act);
      }

      // Enriquecer cada día con datos de DailySummary (fuente de verdad)
      for (const [key, ds] of byDay) {
        // Calcular jornada desde actividades
        const jornada = calcJornada(ds.activities);
        ds.inicioJornada = jornada.inicioJornada;
        ds.inicioComida = jornada.inicioComida;
        ds.finComida = jornada.finComida;
        ds.finJornada = jornada.finJornada;
        ds.totalWork = ds.totalDriving + ds.totalOtherWork + ds.totalAvailability;

        // Determinar confianza promedio de los EVENTOS
        const confidences = ds.activities.map((a: any) => a.confidenceLevel).filter(Boolean);
        if (confidences.includes('low')) ds.averageConfidence = 'low';
        else if (confidences.includes('medium')) ds.averageConfidence = 'medium';
        else if (confidences.includes('high')) ds.averageConfidence = 'high';

        // Estado de consolidación de los EVENTOS (informativo, NO es el estado del día)
        const statuses = ds.activities.map((a: any) => a.consolidationStatus).filter(Boolean);
        if (statuses.includes('excluded')) ds.eventsConsolidationStatus = 'excluded';
        else if (statuses.every((s: string) => s === 'operative')) ds.eventsConsolidationStatus = 'operative';
        else ds.eventsConsolidationStatus = 'provisional';

        // FUENTE DE VERDAD: estado del DÍA desde DailySummary
        const summary = summaryMap.get(key);
        if (summary) {
          ds.dayStatus = summary.dayConsolidationStatus || 'UNKNOWN';
          ds.rawEventsCount = summary.rawEventsCount ?? 0;
          ds.ownSourceMinutes = summary.ownSourceMinutes ?? 0;
          ds.inheritedSplitMinutes = summary.inheritedSplitMinutes ?? 0;
          ds.gapMinutes = summary.gapMinutes ?? 0;
          ds.consistencyStatus = summary.consistencyStatus || 'ok';
          if (summary.averageConfidence) ds.averageConfidence = summary.averageConfidence;
        }
      }

      // Filtrar por dayStatus si se selecciona en dropdown
      let result = Array.from(byDay.values());
      if (selectedConsolidation) {
        result = result.filter(ds => ds.dayStatus === selectedConsolidation);
      }

      const sorted = result.sort((a, b) => b.date.localeCompare(a.date));
      setDaySummaries(sorted);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDriver, dateRange, selectedConsolidation]);

  const shiftDate = (days: number) => {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    from.setDate(from.getDate() + days);
    to.setDate(to.getDate() + days);
    setDateRange({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    });
  };

  const formatMinutes = (min: number) => {
    if (min <= 0) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  };

  const calcWorkHours = (s: JornadaSummary): string => {
    if (!s.inicioJornada || !s.finJornada) return '—';
    const start = new Date(s.inicioJornada);
    const end = new Date(s.finJornada);
    const totalMs = end.getTime() - start.getTime();
    let lunchMs = 0;
    if (s.inicioComida && s.finComida) {
      lunchMs = new Date(s.finComida).getTime() - new Date(s.inicioComida).getTime();
    }
    const netMs = totalMs - lunchMs;
    const netMin = Math.round(netMs / 60000);
    return formatMinutes(netMin);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jornadas / Actividad</h1>
            <p className="text-sm text-gray-500">Resumen de jornada diaria — horas en zona horaria España (CET/CEST)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
        <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="">Todos los conductores</option>
          {drivers.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.linkedEmployee ? `${d.linkedEmployee.nombre} ${d.linkedEmployee.apellidos || ''}`.trim() : d.fullName}
            </option>
          ))}
        </select>

        {/* v2: filtro por estado de consolidación */}
        <select value={selectedConsolidation} onChange={(e) => setSelectedConsolidation(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="">Todos los estados del día</option>
          <option value="VALID">✅ Válido</option>
          <option value="BLOCKED_NO_SOURCE">🚫 Sin datos origen</option>
          <option value="BLOCKED_LOW_CONFIDENCE">⚠️ Baja confianza</option>
          <option value="BLOCKED_CONFLICT">❌ Conflicto</option>
        </select>

        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-7)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange(r => ({...r, from: e.target.value}))} className="px-3 py-2 border rounded-lg text-sm" />
          <span className="text-gray-400 text-sm">a</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange(r => ({...r, to: e.target.value}))} className="px-3 py-2 border rounded-lg text-sm" />
          <button onClick={() => shiftDate(7)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : daySummaries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin datos de actividad</p>
            <p className="text-sm mt-1">Las actividades aparecerán cuando se importen archivos de tacógrafo que contengan registros de actividad</p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Vehículo(s)</th>
                  <th className="px-4 py-3 text-center">Inicio</th>
                  <th className="px-4 py-3 text-center">Comida</th>
                  <th className="px-4 py-3 text-center">Fin Comida</th>
                  <th className="px-4 py-3 text-center">Fin Jornada</th>
                  <th className="px-4 py-3 text-center">Neta</th>
                  <th className="px-4 py-3 text-center">Conducción</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {daySummaries.map((s) => {
                  const rowKey = `${s.date}_${s.driverId}`;
                  const isExpanded = expandedDay === rowKey;
                  const dayInfo = DAY_STATUS_LABELS[s.dayStatus] || DAY_STATUS_LABELS.UNKNOWN;
                  const confInfo = CONFIDENCE_LABELS[s.averageConfidence] || CONFIDENCE_LABELS.medium;
                  const isBlocked = s.dayStatus.startsWith('BLOCKED_');
                  return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className={`hover:bg-gray-50/50 transition-colors cursor-pointer group ${isBlocked ? 'opacity-60 bg-red-50/30' : ''}`}
                      onClick={() => setExpandedDay(isExpanded ? null : rowKey)}
                    >
                      <td className="px-2 py-3 text-center text-gray-400 group-hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {new Date(s.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{s.driverName}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {s.vehiclePlates.length > 0 ? s.vehiclePlates.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${isBlocked ? 'text-gray-400' : 'text-emerald-700'}`}>{formatLocalTime(s.inicioJornada)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={isBlocked ? 'text-gray-400' : 'text-orange-600'}>{formatLocalTime(s.inicioComida)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={isBlocked ? 'text-gray-400' : 'text-orange-600'}>{formatLocalTime(s.finComida)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${isBlocked ? 'text-gray-400' : 'text-red-700'}`}>{formatLocalTime(s.finJornada)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${isBlocked ? 'text-gray-400' : 'text-gray-900'}`}>{calcWorkHours(s)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${isBlocked ? 'text-gray-400' : 'text-blue-700'}`}>{formatMinutes(s.totalDriving)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dayInfo.color}`}>
                          {dayInfo.icon} {dayInfo.label}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="p-0">
                          <div className="bg-gray-50 px-6 py-4 border-t">
                            {/* Aviso BLOCKED_NO_SOURCE */}
                            {s.dayStatus === 'BLOCKED_NO_SOURCE' && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-bold text-red-800">Sin datos de origen para este día</p>
                                  <p className="text-xs text-red-600 mt-0.5">
                                    No existen raw events propios del {new Date(s.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}.
                                    {s.inheritedSplitMinutes > 0 && (
                                      <> Los {s.inheritedSplitMinutes} min visibles son un <strong>split heredado</strong> del día anterior que cruza medianoche.</>
                                    )}
                                    {s.gapMinutes > 0 && <> Gap sin cubrir: {formatMinutes(s.gapMinutes)}.</>}
                                  </p>
                                  <p className="text-[10px] text-red-500 mt-1 font-mono">
                                    rawEventsCount={s.rawEventsCount} · ownSourceMinutes={s.ownSourceMinutes} · inheritedSplitMinutes={s.inheritedSplitMinutes}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Aviso BLOCKED_LOW_CONFIDENCE / BLOCKED_CONFLICT */}
                            {s.dayStatus === 'BLOCKED_LOW_CONFIDENCE' && (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-bold text-amber-800">Baja confianza en los datos</p>
                                  <p className="text-xs text-amber-600 mt-0.5">La mayoría del tiempo observado tiene baja confianza.</p>
                                </div>
                              </div>
                            )}
                            {s.dayStatus === 'BLOCKED_CONFLICT' && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm font-bold text-red-800">Conflicto detectado</p>
                                  <p className="text-xs text-red-600 mt-0.5">Existen datos contradictorios entre fuentes.</p>
                                </div>
                              </div>
                            )}

                            {/* Summary chips */}
                            <div className="flex flex-wrap gap-3 mb-4">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] uppercase font-bold text-blue-500 block">Conducción</span>
                                <span className="text-sm font-bold text-blue-800">{formatMinutes(s.totalDriving)}</span>
                              </div>
                              <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] uppercase font-bold text-purple-500 block">Otros trabajos</span>
                                <span className="text-sm font-bold text-purple-800">{formatMinutes(s.totalOtherWork)}</span>
                              </div>
                              <div className="bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] uppercase font-bold text-cyan-500 block">Disponibilidad</span>
                                <span className="text-sm font-bold text-cyan-800">{formatMinutes(s.totalAvailability)}</span>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] uppercase font-bold text-green-500 block">Descanso</span>
                                <span className="text-sm font-bold text-green-800">{formatMinutes(s.totalRest)}</span>
                              </div>
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
                                <span className="text-[10px] uppercase font-bold text-yellow-600 block">Pausas</span>
                                <span className="text-sm font-bold text-yellow-800">{formatMinutes(s.totalBreak)}</span>
                              </div>
                              {/* Estado del día (DailySummary) + Fiabilidad */}
                              <div className="ml-auto flex gap-2">
                                <div className={`rounded-lg px-3 py-1.5 border ${dayInfo.color}`}>
                                  <span className="text-[10px] uppercase font-bold block">Estado día</span>
                                  <span className="text-sm font-bold">{dayInfo.icon} {dayInfo.label}</span>
                                </div>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Fiabilidad</span>
                                  <span className={`text-sm font-bold ${confInfo.color}`}>{confInfo.label}</span>
                                </div>
                              </div>
                            </div>

                            {/* Activity bar */}
                            {(() => {
                              const getStart = (a: any) => a.startAtLocal || a.startTime;
                              const getEnd = (a: any) => a.endAtLocal || a.endTime;
                              const sortedActs = [...s.activities].sort((a, b) => new Date(getStart(a)).getTime() - new Date(getStart(b)).getTime());
                              if (sortedActs.length === 0) return null;

                              const firstStart = new Date(getStart(sortedActs[0]));
                              const lastEnd = new Date(getEnd(sortedActs[sortedActs.length - 1]));

                              const startHour = Math.max(0, firstStart.getUTCHours());
                              const endHour = Math.min(24, lastEnd.getUTCHours() + (lastEnd.getUTCMinutes() > 0 ? 1 : 0));
                              const totalHours = Math.max(endHour - startHour, 1);

                              const hourMarkers = [];
                              for (let h = startHour; h <= endHour; h++) {
                                const pct = ((h - startHour) / totalHours) * 100;
                                hourMarkers.push({ hour: h, pct });
                              }

                              return (
                                <div className="mb-4">
                                  <div className="relative h-4 mb-0.5">
                                    {hourMarkers.map(({ hour, pct }) => (
                                      <span
                                        key={hour}
                                        className="absolute text-[9px] font-bold text-gray-400 -translate-x-1/2"
                                        style={{ left: `${pct}%` }}
                                      >
                                        {String(hour).padStart(2, '0')}:00
                                      </span>
                                    ))}
                                  </div>
                                  <div className="relative h-8 rounded-lg overflow-hidden border shadow-inner bg-gray-100">
                                    {hourMarkers.map(({ hour, pct }) => (
                                      <div
                                        key={`line-${hour}`}
                                        className="absolute top-0 bottom-0 border-l border-gray-300/50"
                                        style={{ left: `${pct}%` }}
                                      />
                                    ))}
                                    {sortedActs.map((act, idx) => {
                                      const actStart = new Date(getStart(act));
                                      const actEnd = new Date(getEnd(act));
                                      const startMinutes = actStart.getUTCHours() * 60 + actStart.getUTCMinutes();
                                      const endMinutes = actEnd.getUTCHours() * 60 + actEnd.getUTCMinutes();
                                      const startOffset = (startMinutes - startHour * 60) / (totalHours * 60) * 100;
                                      const duration = (endMinutes - startMinutes) / (totalHours * 60) * 100;
                                      if (duration < 0.3) return null;
                                      const actColor = ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-300';
                                      return (
                                        <div
                                          key={idx}
                                          className={`absolute top-0 bottom-0 ${actColor} flex items-center justify-center text-[8px] font-bold text-white/90`}
                                          style={{ left: `${Math.max(0, startOffset)}%`, width: `${Math.min(duration, 100 - startOffset)}%` }}
                                          title={`${ACTIVITY_COLORS[act.activityType]?.label || act.activityType}: ${formatLocalTime(getStart(act))} — ${formatLocalTime(getEnd(act))} (${act.durationMinutes} min)`}
                                        >
                                          {duration > 6 ? formatLocalTime(getStart(act)) : ''}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Detail list */}
                            <div className="grid gap-1">
                              {s.activities
                                .sort((a, b) => new Date(a.startAtLocal || a.startTime).getTime() - new Date(b.startAtLocal || b.startTime).getTime())
                                .map((act, idx) => {
                                  const startStr = formatLocalTime(act.startAtLocal || act.startTime);
                                  const endStr = formatLocalTime(act.endAtLocal || act.endTime);
                                  const actCons = EVENT_STATUS_LABELS[act.consolidationStatus];
                                  return (
                                    <div key={idx} className="flex items-center gap-3 text-xs py-1 px-2 rounded hover:bg-white/70 transition-colors">
                                      <div className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-400'} shadow-sm`} />
                                      <span className="font-semibold w-24 text-gray-800">{ACTIVITY_COLORS[act.activityType]?.label || act.activityType}</span>
                                      <span className="text-gray-500 font-mono">
                                        {startStr}{' → '}{endStr}
                                      </span>
                                      <span className="font-bold text-gray-700">{formatMinutes(act.durationMinutes)}</span>
                                      {act.isSplitCrossMidnight && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-bold" title="Evento heredado de otro día (split cross-midnight)">SPLIT heredado</span>
                                      )}
                                      {act.extractionMethod === 'derived' && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">derivado</span>
                                      )}
                                      {actCons && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ml-auto ${actCons.color}`} title="Estado del evento (no del día)">{actCons.label}</span>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 flex items-center gap-2">
        <Clock className="w-3 h-3" />
        <span>Horas en zona horaria España (CET/CEST). operationalDayLocal del servidor. Inicio Jornada = primera actividad no-descanso. Comida = pausa más larga. Fin Jornada = última conducción/trabajo.</span>
      </div>
    </div>
  );
}
