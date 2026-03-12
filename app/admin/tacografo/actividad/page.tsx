'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CalendarDays, Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRIVING: { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Conducción' },
  OTHER_WORK: { bg: 'bg-purple-500', text: 'text-purple-700', label: 'Otros trabajos' },
  AVAILABILITY: { bg: 'bg-cyan-500', text: 'text-cyan-700', label: 'Disponibilidad' },
  REST: { bg: 'bg-green-500', text: 'text-green-700', label: 'Descanso' },
  BREAK: { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Pausa' },
  UNKNOWN: { bg: 'bg-gray-400', text: 'text-gray-600', label: 'Desconocido' },
};

const WORK_TYPES = ['DRIVING', 'OTHER_WORK', 'AVAILABILITY'];
const REST_TYPES = ['REST', 'BREAK'];

interface JornadaSummary {
  date: string;
  driverName: string;
  driverId: number | null;
  vehiclePlate: string;
  inicioJornada: Date | null;
  inicioComida: Date | null;
  finComida: Date | null;
  finJornada: Date | null;
  totalDriving: number;
  totalOtherWork: number;
  totalAvailability: number;
  totalRest: number;
  totalBreak: number;
  totalWork: number;
  activities: any[];
}

// Convert UTC date to Spain local time string (HH:mm)
function toSpainTime(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
}

// Calculate jornada times from activities
function calcJornada(activities: any[]): {
  inicioJornada: Date | null;
  inicioComida: Date | null;
  finComida: Date | null;
  finJornada: Date | null;
} {
  if (!activities.length) return { inicioJornada: null, inicioComida: null, finComida: null, finJornada: null };

  const sorted = [...activities].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Inicio Jornada: first non-REST/BREAK activity
  let inicioJornada: Date | null = null;
  for (const act of sorted) {
    if (WORK_TYPES.includes(act.activityType)) {
      inicioJornada = new Date(act.startTime);
      break;
    }
  }

  // Fin Jornada: end of last DRIVING or OTHER_WORK activity
  let finJornada: Date | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (['DRIVING', 'OTHER_WORK'].includes(sorted[i].activityType)) {
      finJornada = new Date(sorted[i].endTime);
      break;
    }
  }

  // Comida: longest REST/BREAK period during the workday
  // Only consider rest periods that start after the jornada starts
  // and are not the overnight rest (i.e., there's still work activity after)
  let inicioComida: Date | null = null;
  let finComida: Date | null = null;
  let maxRestMinutes = 0;

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    if (!REST_TYPES.includes(act.activityType)) continue;

    const restStart = new Date(act.startTime);
    const restEnd = new Date(act.endTime);
    const restMins = act.durationMinutes || 0;

    // Check if there's work activity BEFORE and AFTER this rest (it's a mid-day break, not overnight)
    const hasWorkBefore = sorted.slice(0, i).some((a: any) => WORK_TYPES.includes(a.activityType));
    const hasWorkAfter = sorted.slice(i + 1).some((a: any) => WORK_TYPES.includes(a.activityType));

    if (hasWorkBefore && hasWorkAfter && restMins > maxRestMinutes) {
      // Check for consecutive rest blocks (REST followed immediately by another REST/BREAK)
      let cumulativeEnd = restEnd;
      let cumulativeMins = restMins;
      for (let j = i + 1; j < sorted.length; j++) {
        if (REST_TYPES.includes(sorted[j].activityType)) {
          const nextStart = new Date(sorted[j].startTime);
          const gap = (nextStart.getTime() - cumulativeEnd.getTime()) / 60000;
          if (gap <= 5) { // Allow 5 min gap between consecutive rests
            cumulativeEnd = new Date(sorted[j].endTime);
            cumulativeMins += sorted[j].durationMinutes || 0;
          } else break;
        } else break;
      }

      if (cumulativeMins > maxRestMinutes) {
        maxRestMinutes = cumulativeMins;
        inicioComida = restStart;
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

      const [actRes, drvRes] = await Promise.all([
        fetch(`/api/tacografo/activities?${params}`),
        fetch('/api/tacografo/drivers')
      ]);

      let actData: any[] = [];
      if (actRes.ok) {
        const json = await actRes.json();
        actData = json.data || [];
      }
      if (drvRes.ok) setDrivers(await drvRes.json());

      // Group activities by day + driver
      const byDay = new Map<string, JornadaSummary>();
      for (const act of actData) {
        // Use Spain timezone to determine the date
        const utcDate = new Date(act.startTime);
        const spainDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
        const key = `${spainDate.getFullYear()}-${String(spainDate.getMonth() + 1).padStart(2, '0')}-${String(spainDate.getDate()).padStart(2, '0')}`;
        const driverId = act.driverId;
        const driverName = act.driver?.linkedEmployee
          ? `${act.driver.linkedEmployee.nombre} ${act.driver.linkedEmployee.apellidos || ''}`.trim()
          : act.driver?.fullName || 'Desconocido';
        const compositeKey = `${key}_${driverId || 'none'}`;

        if (!byDay.has(compositeKey)) {
          byDay.set(compositeKey, {
            date: key,
            driverName,
            driverId,
            vehiclePlate: act.vehicle?.plateNumber || act.vehicle?.linkedVehicle?.matricula || '—',
            inicioJornada: null, inicioComida: null, finComida: null, finJornada: null,
            totalDriving: 0, totalOtherWork: 0, totalAvailability: 0,
            totalRest: 0, totalBreak: 0, totalWork: 0,
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
        ds.activities.push(act);
      }

      // Calculate jornada times for each day
      for (const ds of byDay.values()) {
        const jornada = calcJornada(ds.activities);
        ds.inicioJornada = jornada.inicioJornada;
        ds.inicioComida = jornada.inicioComida;
        ds.finComida = jornada.finComida;
        ds.finJornada = jornada.finJornada;
        ds.totalWork = ds.totalDriving + ds.totalOtherWork + ds.totalAvailability;
      }

      const sorted = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date));
      setDaySummaries(sorted);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDriver, dateRange]);

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
    const totalMs = s.finJornada.getTime() - s.inicioJornada.getTime();
    const lunchMs = (s.inicioComida && s.finComida) ? s.finComida.getTime() - s.inicioComida.getTime() : 0;
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
            <p className="text-sm text-gray-500">Resumen de jornada diaria — horas en zona horaria España</p>
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
                  <th className="px-4 py-3">Vehículo</th>
                  <th className="px-4 py-3 text-center">Inicio Jornada</th>
                  <th className="px-4 py-3 text-center">Inicio Comida</th>
                  <th className="px-4 py-3 text-center">Fin Comida</th>
                  <th className="px-4 py-3 text-center">Fin Jornada</th>
                  <th className="px-4 py-3 text-center">Jornada Neta</th>
                  <th className="px-4 py-3 text-center">Conducción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {daySummaries.map((s) => {
                  const rowKey = `${s.date}_${s.driverId}`;
                  const isExpanded = expandedDay === rowKey;
                  return (
                  <React.Fragment key={rowKey}>
                    <tr
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                      onClick={() => setExpandedDay(isExpanded ? null : rowKey)}
                    >
                      <td className="px-2 py-3 text-center text-gray-400 group-hover:text-gray-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {new Date(s.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{s.driverName}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.vehiclePlate}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-emerald-700 text-base">{toSpainTime(s.inicioJornada)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-600">{toSpainTime(s.inicioComida)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-orange-600">{toSpainTime(s.finComida)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-red-700 text-base">{toSpainTime(s.finJornada)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-900">{calcWorkHours(s)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-blue-700 font-bold">{formatMinutes(s.totalDriving)}</span>
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <div className="bg-gray-50 px-6 py-4 border-t">
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
                            </div>

                            {/* Activity bar */}
                            <div className="flex h-8 rounded-lg overflow-hidden mb-4 border shadow-inner">
                              {s.activities
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                .map((act, idx) => {
                                  const totalMins = s.activities.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);
                                  const pct = totalMins > 0 ? ((act.durationMinutes || 0) / totalMins * 100) : 0;
                                  if (pct < 0.5) return null;
                                  return (
                                    <div
                                      key={idx}
                                      className={`${ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-300'} flex items-center justify-center text-[9px] font-bold text-white/90 border-r border-white/20 last:border-r-0`}
                                      style={{ width: `${pct}%` }}
                                      title={`${ACTIVITY_COLORS[act.activityType]?.label || act.activityType}: ${toSpainTime(new Date(act.startTime))} — ${toSpainTime(new Date(act.endTime))} (${act.durationMinutes} min)`}
                                    >
                                      {pct > 8 ? `${act.durationMinutes}m` : ''}
                                    </div>
                                  );
                                })}
                            </div>

                            {/* Detail list */}
                            <div className="grid gap-1">
                              {s.activities
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                .map((act, idx) => (
                                  <div key={idx} className="flex items-center gap-3 text-xs py-1 px-2 rounded hover:bg-white/70 transition-colors">
                                    <div className={`w-2.5 h-2.5 rounded-full ${ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-400'} shadow-sm`} />
                                    <span className="font-semibold w-24 text-gray-800">{ACTIVITY_COLORS[act.activityType]?.label || act.activityType}</span>
                                    <span className="text-gray-500 font-mono">
                                      {toSpainTime(new Date(act.startTime))}
                                      {' → '}
                                      {toSpainTime(new Date(act.endTime))}
                                    </span>
                                    <span className="font-bold text-gray-700 ml-auto">{formatMinutes(act.durationMinutes)}</span>
                                  </div>
                                ))}
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
        <span>Todas las horas están en zona horaria España (CET/CEST). Inicio Jornada = primera actividad no-descanso. Comida = pausa más larga durante la jornada. Fin Jornada = última conducción/trabajo.</span>
      </div>
    </div>
  );
}
