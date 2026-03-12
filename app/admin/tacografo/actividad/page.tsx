'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CalendarDays, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DRIVING: { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Conducción' },
  OTHER_WORK: { bg: 'bg-purple-500', text: 'text-purple-700', label: 'Otros trabajos' },
  AVAILABILITY: { bg: 'bg-cyan-500', text: 'text-cyan-700', label: 'Disponibilidad' },
  REST: { bg: 'bg-green-500', text: 'text-green-700', label: 'Descanso' },
  BREAK: { bg: 'bg-yellow-500', text: 'text-yellow-700', label: 'Pausa' },
  UNKNOWN: { bg: 'bg-gray-400', text: 'text-gray-600', label: 'Desconocido' },
};

export default function ActividadPage() {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    return {
      from: weekStart.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  });
  const [view, setView] = useState<'daily'|'weekly'>('daily');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDriver) params.set('driverId', selectedDriver);
      if (dateRange.from) params.set('dateFrom', dateRange.from);
      if (dateRange.to) params.set('dateTo', dateRange.to);

      const [sumRes, drvRes] = await Promise.all([
        fetch(`/api/tacografo/daily-summary?${params}`),
        fetch('/api/tacografo/drivers')
      ]);

      if (sumRes.ok) setSummaries(await sumRes.json());
      if (drvRes.ok) setDrivers(await drvRes.json());
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
        ) : summaries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin datos de actividad</p>
            <p className="text-sm mt-1">Los resúmenes aparecerán cuando se importen y procesen archivos con actividades</p>
          </div>
        ) : (
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
                <th className="px-4 py-3 text-center">Pausas</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaries.map((s) => {
                const total = s.totalDrivingMinutes + s.totalOtherWorkMinutes + s.totalAvailabilityMinutes + s.totalRestMinutes + s.totalBreakMinutes;
                const maxMin = 24 * 60;
                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {new Date(s.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.driver?.fullName || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{s.vehicle?.plateNumber || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-blue-700 font-bold">{s.totalDrivingMinutes > 0 ? formatMinutes(s.totalDrivingMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-purple-700">{s.totalOtherWorkMinutes > 0 ? formatMinutes(s.totalOtherWorkMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-cyan-700">{s.totalAvailabilityMinutes > 0 ? formatMinutes(s.totalAvailabilityMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-green-700">{s.totalRestMinutes > 0 ? formatMinutes(s.totalRestMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-yellow-700">{s.totalBreakMinutes > 0 ? formatMinutes(s.totalBreakMinutes) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900">
                      {total > 0 ? formatMinutes(total) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        s.consistencyStatus === 'ok' ? 'bg-green-100 text-green-800' :
                        s.consistencyStatus === 'warning' ? 'bg-orange-100 text-orange-800' :
                        s.consistencyStatus === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>{s.consistencyStatus === 'ok' ? 'OK' : s.consistencyStatus === 'pending' ? 'Pendiente' : s.consistencyStatus}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
