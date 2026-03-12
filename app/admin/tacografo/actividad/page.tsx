'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CalendarDays, Clock, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRIVING: { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Conducción' },
  OTHER_WORK: { bg: 'bg-purple-500', text: 'text-purple-700', label: 'Otros trabajos' },
  AVAILABILITY: { bg: 'bg-cyan-500', text: 'text-cyan-700', label: 'Disponibilidad' },
  REST: { bg: 'bg-green-500', text: 'text-green-700', label: 'Descanso' },
  BREAK: { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Pausa' },
  UNKNOWN: { bg: 'bg-gray-400', text: 'text-gray-600', label: 'Desconocido' },
};

interface DaySummary {
  date: string;
  driverName: string;
  driverId: number | null;
  vehiclePlate: string;
  totalDriving: number;
  totalOtherWork: number;
  totalAvailability: number;
  totalRest: number;
  totalBreak: number;
  total: number;
  activities: any[];
}

export default function ActividadPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
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
  const [view, setView] = useState<'daily'|'weekly'>('daily');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
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

      setActivities(actData);

      // Group activities by day
      const byDay = new Map<string, DaySummary>();
      for (const act of actData) {
        const d = new Date(act.startTime);
        const key = d.toISOString().split('T')[0];
        const driverName = act.driver?.fullName || 'Desconocido';
        const driverId = act.driverId;
        const compositeKey = `${key}_${driverId || 'none'}`;

        if (!byDay.has(compositeKey)) {
          byDay.set(compositeKey, {
            date: key,
            driverName,
            driverId,
            vehiclePlate: act.vehicle?.plateNumber || act.vehicle?.linkedVehicle?.matricula || '—',
            totalDriving: 0,
            totalOtherWork: 0,
            totalAvailability: 0,
            totalRest: 0,
            totalBreak: 0,
            total: 0,
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
        ds.total += mins;
        ds.activities.push(act);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jornadas / Actividad</h1>
            <p className="text-sm text-gray-500">Actividad diaria por conductor desde el tacógrafo</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
        <select value={selectedDriver} onChange={(e) => setSelectedDriver(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white">
          <option value="">Todos los conductores</option>
          {drivers.map((d: any) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(-7)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange(r => ({...r, from: e.target.value}))} className="px-3 py-2 border rounded-lg text-sm" />
          <span className="text-gray-400 text-sm">a</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange(r => ({...r, to: e.target.value}))} className="px-3 py-2 border rounded-lg text-sm" />
          <button onClick={() => shiftDate(7)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setView('daily')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${view === 'daily' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Diaria</button>
          <button onClick={() => setView('weekly')} className={`px-3 py-1.5 text-xs font-medium rounded-lg ${view === 'weekly' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Semanal</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(ACTIVITY_COLORS).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${config.bg}`}></div>
            <span className="text-xs text-gray-600">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : daySummaries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin datos de actividad</p>
            <p className="text-sm mt-1">Las actividades aparecerán cuando se importen archivos de tacógrafo que contengan registros de actividad</p>
            <p className="text-xs mt-2 text-gray-300">Si ya has importado archivos, es posible que el parser no haya podido extraer actividades del contenido binario</p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Conductor</th>
                  <th className="px-4 py-3">Vehículo</th>
                  <th className="px-4 py-3 text-center">Conducción</th>
                  <th className="px-4 py-3 text-center">Otros Trab.</th>
                  <th className="px-4 py-3 text-center">Disponib.</th>
                  <th className="px-4 py-3 text-center">Descanso</th>
                  <th className="px-4 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {daySummaries.map((s) => (
                  <React.Fragment key={`${s.date}_${s.driverId}`}>
                    <tr
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedDay(expandedDay === `${s.date}_${s.driverId}` ? null : `${s.date}_${s.driverId}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{s.driverName}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.vehiclePlate}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-blue-700 font-bold">{formatMinutes(s.totalDriving)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-purple-700">{formatMinutes(s.totalOtherWork)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-cyan-700">{formatMinutes(s.totalAvailability)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-700">{formatMinutes(s.totalRest)}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-900">
                        {formatMinutes(s.total)}
                      </td>
                    </tr>
                    {/* Expanded detail */}
                    {expandedDay === `${s.date}_${s.driverId}` && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="bg-gray-50 px-6 py-3 border-t">
                            {/* Activity bar */}
                            <div className="flex h-6 rounded overflow-hidden mb-3 border">
                              {s.activities
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                .map((act, idx) => {
                                  const pct = s.total > 0 ? ((act.durationMinutes || 0) / s.total * 100) : 0;
                                  if (pct < 0.5) return null;
                                  return (
                                    <div
                                      key={idx}
                                      className={`${ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-300'} flex items-center justify-center text-[9px] font-bold text-white`}
                                      style={{ width: `${pct}%` }}
                                      title={`${ACTIVITY_COLORS[act.activityType]?.label || act.activityType}: ${act.durationMinutes} min`}
                                    />
                                  );
                                })}
                            </div>
                            {/* Detail list */}
                            <div className="space-y-1">
                              {s.activities
                                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                                .map((act, idx) => (
                                  <div key={idx} className="flex items-center gap-3 text-xs">
                                    <div className={`w-2 h-2 rounded-full ${ACTIVITY_COLORS[act.activityType]?.bg || 'bg-gray-400'}`} />
                                    <span className="font-medium w-24">{ACTIVITY_COLORS[act.activityType]?.label || act.activityType}</span>
                                    <span className="text-gray-500">
                                      {new Date(act.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                      {' — '}
                                      {new Date(act.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="font-bold text-gray-700">{formatMinutes(act.durationMinutes)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
