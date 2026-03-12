'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Eye, XCircle, AlertTriangle, Filter, X } from 'lucide-react';

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  CRITICAL: { color: 'bg-red-500 text-white', label: 'Crítica' },
  HIGH: { color: 'bg-red-100 text-red-800 border border-red-200', label: 'Alta' },
  MEDIUM: { color: 'bg-orange-100 text-orange-800 border border-orange-200', label: 'Media' },
  LOW: { color: 'bg-yellow-100 text-yellow-800 border border-yellow-200', label: 'Baja' },
  INFO: { color: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Info' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  OPEN: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Abierta', icon: AlertCircle },
  IN_PROGRESS: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'En progreso', icon: Clock },
  RESOLVED: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Resuelta', icon: CheckCircle },
  DISMISSED: { color: 'bg-gray-50 text-gray-500 border-gray-200', label: 'Descartada', icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  PARSE_ERROR: 'Error de parseo',
  DUPLICATE_FILE: 'Archivo duplicado',
  UNIDENTIFIED_DRIVER: 'Conductor no identificado',
  UNIDENTIFIED_VEHICLE: 'Vehículo no identificado',
  DATA_OVERLAP: 'Solapamiento de datos',
  DRIVING_TIME_EXCEEDED: 'Exceso conducción',
  MISSING_REST: 'Descanso faltante',
  MANUAL_EDIT_CONFLICT: 'Conflicto edición manual',
  OTHER: 'Otro',
};

export default function IncidenciasPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [resolving, setResolving] = useState<number|null>(null);
  const [resolution, setResolution] = useState({ status: 'RESOLVED', notes: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (typeFilter) params.set('type', typeFilter);
      const res = await fetch(`/api/tacografo/incidents?${params}`);
      if (res.ok) setIncidents(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [statusFilter, severityFilter, typeFilter]);

  const resolveIncident = async (id: number) => {
    await fetch(`/api/tacografo/incidents/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionStatus: resolution.status, resolutionNotes: resolution.notes })
    });
    setResolving(null);
    setResolution({ status: 'RESOLVED', notes: '' });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-red-500 rounded-xl shadow-lg">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Incidencias</h1>
            <p className="text-sm text-gray-500">Incidencias detectadas automáticamente</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-xl border shadow-sm">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todas las severidades</option>
          {Object.entries(SEVERITY_CONFIG).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-500">{incidents.length} incidencias</span>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32 bg-white rounded-xl border"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin incidencias</p>
            <p className="text-sm mt-1">No hay incidencias que coincidan con los filtros</p>
          </div>
        ) : incidents.map((inc) => {
          const sevConf = SEVERITY_CONFIG[inc.severity] || { color: 'bg-gray-100', label: inc.severity };
          const stConf = STATUS_CONFIG[inc.resolutionStatus] || { color: 'bg-gray-50', label: inc.resolutionStatus, icon: AlertCircle };
          const StIcon = stConf.icon;
          return (
            <div key={inc.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? 'bg-red-100' : 'bg-orange-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? 'text-red-600' : 'text-orange-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{inc.title}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sevConf.color}`}>{sevConf.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${stConf.color} inline-flex items-center gap-1`}>
                      <StIcon className="w-3 h-3" />{stConf.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{TYPE_LABELS[inc.incidentType] || inc.incidentType}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{inc.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{new Date(inc.createdAt).toLocaleString('es-ES')}</span>
                    {inc.driver && <span>Conductor: {inc.driver.fullName}</span>}
                    {inc.vehicle && <span>Vehículo: {inc.vehicle.plateNumber}</span>}
                    {inc.import && <span>Archivo: {inc.import.fileName}</span>}
                  </div>
                  {inc.resolutionNotes && (
                    <p className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5 mt-2 border border-green-200">
                      <span className="font-bold">Resolución:</span> {inc.resolutionNotes}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {inc.resolutionStatus === 'OPEN' || inc.resolutionStatus === 'IN_PROGRESS' ? (
                    resolving === inc.id ? (
                      <div className="space-y-2 w-64">
                        <select value={resolution.status} onChange={(e) => setResolution(r => ({...r, status: e.target.value}))} className="w-full text-xs border rounded-lg px-2 py-1.5">
                          <option value="RESOLVED">Resolver</option>
                          <option value="IN_PROGRESS">En progreso</option>
                          <option value="DISMISSED">Descartar</option>
                        </select>
                        <textarea value={resolution.notes} onChange={(e) => setResolution(r => ({...r, notes: e.target.value}))} placeholder="Notas de resolución..." className="w-full text-xs border rounded-lg px-2 py-1.5 h-16 resize-none" />
                        <div className="flex gap-1">
                          <button onClick={() => resolveIncident(inc.id)} className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">Guardar</button>
                          <button onClick={() => setResolving(null)} className="px-3 py-1.5 border rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setResolving(inc.id)} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium border border-blue-200">Gestionar</button>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
