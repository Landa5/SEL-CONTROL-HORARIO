'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Upload, Users, Truck, AlertCircle, Clock, FileText, TrendingUp, RefreshCw } from 'lucide-react';

interface DashboardData {
  stats: {
    importsToday: number;
    importsWeek: number;
    importsMonth: number;
    importsError: number;
    activeDrivers: number;
    activeVehicles: number;
    openIncidents: number;
    pendingReview: number;
  };
  recentImports: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Procesando', color: 'bg-blue-100 text-blue-800' },
  PROCESSED_OK: { label: 'Correcto', color: 'bg-green-100 text-green-800' },
  PROCESSED_WARNINGS: { label: 'Con avisos', color: 'bg-orange-100 text-orange-800' },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800' },
};

export default function TacografoDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tacografo/dashboard');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Error fetching dashboard:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const stats = data?.stats || {
    importsToday: 0, importsWeek: 0, importsMonth: 0, importsError: 0,
    activeDrivers: 0, activeVehicles: 0, openIncidents: 0, pendingReview: 0,
  };

  const statCards = [
    { label: 'Importaciones Hoy', value: stats.importsToday, icon: Upload, color: 'from-blue-500 to-blue-600' },
    { label: 'Importaciones Semana', value: stats.importsWeek, icon: FileText, color: 'from-indigo-500 to-indigo-600' },
    { label: 'Importaciones Mes', value: stats.importsMonth, icon: TrendingUp, color: 'from-purple-500 to-purple-600' },
    { label: 'Con Errores', value: stats.importsError, icon: AlertCircle, color: stats.importsError > 0 ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500' },
    { label: 'Conductores', value: stats.activeDrivers, icon: Users, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Vehículos', value: stats.activeVehicles, icon: Truck, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Incidencias Abiertas', value: stats.openIncidents, icon: AlertCircle, color: stats.openIncidents > 0 ? 'from-amber-500 to-amber-600' : 'from-gray-400 to-gray-500' },
    { label: 'Pendientes Revisión', value: stats.pendingReview, icon: Clock, color: stats.pendingReview > 0 ? 'from-orange-500 to-orange-600' : 'from-gray-400 to-gray-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <Disc3 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tacógrafo Digital</h1>
            <p className="text-sm text-gray-500">Panel de control del módulo de tacógrafo</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
              <div className={`h-1 bg-gradient-to-r ${card.color}`}></div>
            </div>
          );
        })}
      </div>

      {/* Recent Imports */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Últimas Importaciones</h2>
        </div>
        <div className="overflow-x-auto">
          {data?.recentImports && data.recentImports.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                  <th className="px-6 py-3">Archivo</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Conductor</th>
                  <th className="px-6 py-3">Vehículo</th>
                  <th className="px-6 py-3">Tamaño</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.recentImports.map((imp: any) => {
                  const statusInfo = STATUS_LABELS[imp.importStatus] || { label: imp.importStatus, color: 'bg-gray-100 text-gray-800' };
                  return (
                    <tr key={imp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 truncate max-w-[200px]">{imp.fileName}</div>
                        <div className="text-xs text-gray-400">{imp.originalExtension}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(imp.importDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {imp.driver?.fullName || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {imp.vehicle?.plateNumber || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {(imp.fileSize / 1024).toFixed(1)} KB
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Disc3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin importaciones todavía</p>
              <p className="text-sm mt-1">Sube archivos de tacógrafo en la sección de Importaciones</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
