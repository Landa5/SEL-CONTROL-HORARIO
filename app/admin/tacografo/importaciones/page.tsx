'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, RefreshCw, Search, Eye, RotateCcw, CheckCircle, AlertTriangle, XCircle, Clock, X, Download, Trash2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  PROCESSING: { label: 'Procesando', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCw },
  PROCESSED_OK: { label: 'Correcto', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  PROCESSED_WARNINGS: { label: 'Con avisos', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

const ACTIVITY_COLORS: Record<string, string> = {
  DRIVING: 'bg-blue-100 text-blue-800 border-blue-300',
  REST: 'bg-green-100 text-green-800 border-green-300',
  OTHER_WORK: 'bg-purple-100 text-purple-800 border-purple-300',
  AVAILABILITY: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  BREAK: 'bg-green-100 text-green-800 border-green-300',
  UNKNOWN: 'bg-gray-100 text-gray-600 border-gray-300',
};

const ACTIVITY_LABELS: Record<string, string> = {
  DRIVING: 'Conducción',
  REST: 'Descanso',
  OTHER_WORK: 'Otro trabajo',
  AVAILABILITY: 'Disponibilidad',
  BREAK: 'Pausa',
  UNKNOWN: 'Desconocido',
};

export default function ImportacionesPage() {
  const [imports, setImports] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedImport, setSelectedImport] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[] | null>(null);

  const fetchImports = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/tacografo/imports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setImports(data.data);
        setPagination(data.pagination);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchImports(); }, [fetchImports]);

  const handleUpload = async (files: FileList | File[]) => {
    if (!files.length) return;
    setUploading(true);
    setUploadResults(null);
    const results: any[] = [];
    
    // Upload files one by one as base64 JSON to avoid WAF blocking binary content
    for (const file of Array.from(files)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        const res = await fetch('/api/tacografo/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: [{
              name: file.name,
              type: file.type || 'application/octet-stream',
              base64
            }]
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          results.push(...(data.results || []));
        } else {
          let errorMsg = `Error del servidor (${res.status})`;
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch {}
          results.push({ fileName: file.name, success: false, status: 'ERROR', errors: [errorMsg], warnings: [] });
        }
      } catch (e: any) {
        results.push({ fileName: file.name, success: false, status: 'ERROR', errors: [e.message || 'Error desconocido'], warnings: [] });
      }
    }
    
    setUploadResults(results);
    fetchImports();
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
  };

  const viewDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tacografo/imports/${id}`);
      if (res.ok) setSelectedImport(await res.json());
    } catch (e) { console.error(e); }
    setDetailLoading(false);
  };

  const markReviewed = async (id: number) => {
    await fetch(`/api/tacografo/imports/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: true })
    });
    fetchImports();
    if (selectedImport?.id === id) viewDetail(id);
  };

  const reprocess = async (id: number) => {
    await fetch(`/api/tacografo/imports/${id}/reprocess`, { method: 'POST' });
    fetchImports();
  };

  const deleteImport = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta importación? Se borrarán todos los datos asociados (actividades, incidencias, resúmenes).')) return;
    try {
      const res = await fetch(`/api/tacografo/imports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchImports();
        if (selectedImport?.id === id) setSelectedImport(null);
      } else {
        const errData = await res.json();
        alert(`Error al eliminar: ${errData.error || 'Error desconocido'}`);
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importaciones</h1>
            <p className="text-sm text-gray-500">Gestión de archivos de tacógrafo importados</p>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        id="fileInput"
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUpload(e.target.files);
          }
          e.target.value = '';
        }}
        accept=".ddd,.dtco,.tgd,.v1b,.c1b,.esm,.csv"
      />

      {/* Upload Dropzone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-blue-500 bg-blue-50 scale-[1.01]'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('fileInput')?.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="text-blue-600 font-semibold">Procesando archivos...</p>
          </div>
        ) : (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-3 ${dragActive ? 'text-blue-500' : 'text-gray-300'}`} />
            <p className="text-lg font-semibold text-gray-700">
              {dragActive ? '¡Suelta aquí!' : 'Arrastra archivos de tacógrafo aquí'}
            </p>
            <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionar • Formatos: .ddd, .dtco, .tgd, .v1b, .c1b, .esm, .csv (Ministerio)</p>
          </>
        )}
      </div>

      {/* Upload Results */}
      {uploadResults && (
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Resultado de importación</h3>
            <button onClick={() => setUploadResults(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          {uploadResults.map((r: any, i: number) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
              {r.success ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{r.fileName}</p>
                {r.warnings?.length > 0 && <p className="text-xs text-orange-600 mt-0.5">{r.warnings.length} aviso(s)</p>}
                {r.errors?.length > 0 && <p className="text-xs text-red-600 mt-0.5">{r.errors[0]}</p>}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_CONFIG[r.status]?.color || 'bg-gray-100'}`}>
                {STATUS_CONFIG[r.status]?.label || r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <button onClick={() => fetchImports()} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
        <span className="text-sm text-gray-500 ml-auto">{pagination.total} importaciones</span>
      </div>

      {/* Imports Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin importaciones</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Conductor</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Rango</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {imports.map((imp) => {
                const st = STATUS_CONFIG[imp.importStatus] || { label: imp.importStatus, color: 'bg-gray-100', icon: Clock };
                const StIcon = st.icon;
                return (
                  <tr key={imp.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[180px]">{imp.fileName}</div>
                      <div className="text-xs text-gray-400">{(imp.fileSize / 1024).toFixed(1)} KB</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(imp.importDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      <span className="text-xs text-gray-400 ml-1">
                        {new Date(imp.importDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.color}`}>
                        <StIcon className="w-3 h-3" />{st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]">
                      {imp.driver?.linkedEmployee
                        ? `${imp.driver.linkedEmployee.nombre} ${imp.driver.linkedEmployee.apellidos || ''}`.trim()
                        : imp.driver?.fullName || imp.detectedDriverName || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {imp.vehicle?.plateNumber || imp.detectedPlate || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {imp.detectedDateFrom
                        ? `${new Date(imp.detectedDateFrom).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — ${imp.detectedDateTo ? new Date(imp.detectedDateTo).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '?'}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => viewDetail(imp.id)} title="Ver detalle" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => reprocess(imp.id)} title="Reprocesar" className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600"><RotateCcw className="w-4 h-4" /></button>
                        {!imp.reviewedAt && <button onClick={() => markReviewed(imp.id)} title="Marcar revisado" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"><CheckCircle className="w-4 h-4" /></button>}
                        <button onClick={() => deleteImport(imp.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <button disabled={pagination.page <= 1} onClick={() => fetchImports(pagination.page - 1)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">Anterior</button>
            <span className="text-sm text-gray-500">Pág. {pagination.page} de {pagination.totalPages}</span>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchImports(pagination.page + 1)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">Siguiente</button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedImport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">Detalle de Importación</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => deleteImport(selectedImport.id)} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" />Eliminar
                </button>
                <button onClick={() => setSelectedImport(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* File Info */}
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Archivo" value={selectedImport.fileName} />
                  <InfoItem label="Estado" value={STATUS_CONFIG[selectedImport.importStatus]?.label || selectedImport.importStatus} />
                  <InfoItem label="Tipo" value={selectedImport.fileType === 'DRIVER_CARD' ? 'Tarjeta Conductor' : selectedImport.fileType === 'VEHICLE_UNIT' ? 'Unidad Vehículo' : 'Desconocido'} />
                  <InfoItem label="Tamaño" value={`${(selectedImport.fileSize / 1024).toFixed(1)} KB`} />
                  <InfoItem label="Hash" value={selectedImport.fileHash?.substring(0, 16) + '...'} />
                  <InfoItem label="Parser" value={selectedImport.parserVersion || '—'} />
                  <InfoItem label="Importado" value={new Date(selectedImport.importDate).toLocaleString('es-ES')} />
                  <InfoItem label="Procesado" value={selectedImport.processedAt ? new Date(selectedImport.processedAt).toLocaleString('es-ES') : '—'} />
                  {selectedImport.driver && (
                    <InfoItem label="Conductor" value={`${selectedImport.driver.fullName}${selectedImport.driver.linkedEmployee ? ` → ${selectedImport.driver.linkedEmployee.nombre}` : ' (sin vincular)'}`} />
                  )}
                  {selectedImport.vehicle && (
                    <InfoItem label="Vehículo" value={`${selectedImport.vehicle.plateNumber || selectedImport.vehicle.vin || '—'}${selectedImport.vehicle.linkedVehicle ? ` → ${selectedImport.vehicle.linkedVehicle.matricula}` : ' (sin vincular)'}`} />
                  )}
                  {selectedImport.detectedDateFrom && (
                    <InfoItem label="Rango de datos" value={`${new Date(selectedImport.detectedDateFrom).toLocaleDateString('es-ES')} — ${selectedImport.detectedDateTo ? new Date(selectedImport.detectedDateTo).toLocaleDateString('es-ES') : '?'}`} />
                  )}
                </div>

                {/* Metadata */}
                {selectedImport.rawMetadataJson && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2 text-sm">Metadatos Extraídos</h3>
                    <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto border">{JSON.stringify(typeof selectedImport.rawMetadataJson === 'string' ? JSON.parse(selectedImport.rawMetadataJson) : selectedImport.rawMetadataJson, null, 2)}</pre>
                  </div>
                )}

                {/* Eventos Normalizados v2 */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2 text-sm">
                    Eventos Normalizados {selectedImport.normalizedEvents?.length > 0 ? `(${selectedImport.normalizedEvents.length})` : ''}
                  </h3>
                  {selectedImport.normalizedEvents?.length > 0 ? (
                    <div className="space-y-1">
                      {/* Summary bar */}
                      <div className="flex h-8 rounded-lg overflow-hidden mb-3 border">
                        {selectedImport.normalizedEvents.map((act: any, idx: number) => {
                          const totalMinutes = selectedImport.normalizedEvents.reduce((s: number, a: any) => s + (a.durationMinutes || 0), 0);
                          const pct = totalMinutes > 0 ? ((act.durationMinutes || 0) / totalMinutes * 100) : 0;
                          if (pct < 1) return null;
                          const actType = act.normalizedActivityType || act.activityType;
                          return (
                            <div
                              key={idx}
                              className={`${ACTIVITY_COLORS[actType]?.split(' ')[0] || 'bg-gray-200'} flex items-center justify-center text-[10px] font-bold`}
                              style={{ width: `${pct}%` }}
                              title={`${ACTIVITY_LABELS[actType] || actType}: ${act.durationMinutes} min`}
                            >
                              {pct > 8 ? ACTIVITY_LABELS[actType]?.substring(0, 4) : ''}
                            </div>
                          );
                        })}
                      </div>
                      {/* Event list */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] font-bold text-gray-500 uppercase border-b">
                              <th className="pb-1 pr-3">Actividad</th>
                              <th className="pb-1 pr-3">Inicio (local)</th>
                              <th className="pb-1 pr-3">Fin (local)</th>
                              <th className="pb-1 pr-3">Duración</th>
                              <th className="pb-1 pr-3">Fiabilidad</th>
                              <th className="pb-1 pr-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedImport.normalizedEvents.map((act: any, idx: number) => {
                              const actType = act.normalizedActivityType || act.activityType;
                              const startLocal = act.startAtLocal || act.startAtUtc || act.startTime;
                              const endLocal = act.endAtLocal || act.endAtUtc || act.endTime;
                              return (
                              <tr key={act.id || idx} className="hover:bg-gray-50">
                                <td className="py-1.5 pr-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${ACTIVITY_COLORS[actType] || ACTIVITY_COLORS.UNKNOWN}`}>
                                    {ACTIVITY_LABELS[actType] || actType}
                                  </span>
                                  {act.isSplitCrossMidnight && <span className="ml-1 text-[8px] text-violet-600 font-bold">SPLIT</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-gray-600">{new Date(startLocal).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                                <td className="py-1.5 pr-3 text-gray-600">{new Date(endLocal).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                                <td className="py-1.5 pr-3 font-medium">
                                  {act.durationMinutes >= 60
                                    ? `${Math.floor(act.durationMinutes / 60)}h ${act.durationMinutes % 60}min`
                                    : `${act.durationMinutes} min`}
                                </td>
                                <td className="py-1.5 pr-3">
                                  <span className={`text-[10px] font-bold ${act.confidenceLevel === 'high' ? 'text-green-700' : act.confidenceLevel === 'low' ? 'text-red-700' : 'text-amber-700'}`}>
                                    {act.confidenceLevel || '—'}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${act.consolidationStatus === 'operative' ? 'bg-green-50 text-green-700' : act.consolidationStatus === 'excluded' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {act.consolidationStatus || '—'}
                                  </span>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Totals */}
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {(['DRIVING', 'REST', 'OTHER_WORK', 'AVAILABILITY'] as const).map(type => {
                          const totalMin = selectedImport.normalizedEvents
                            .filter((a: any) => (a.normalizedActivityType || a.activityType) === type)
                            .reduce((s: number, a: any) => s + (a.durationMinutes || 0), 0);
                          if (totalMin === 0) return null;
                          return (
                            <div key={type} className={`p-2 rounded-lg border ${ACTIVITY_COLORS[type]}`}>
                              <div className="font-bold text-[10px] uppercase">{ACTIVITY_LABELS[type]}</div>
                              <div className="font-bold text-sm">{Math.floor(totalMin / 60)}h {totalMin % 60}min</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500 font-medium">No se detectaron eventos en este archivo</p>
                      <p className="text-xs text-gray-400 mt-1">El parser binario no pudo extraer registros de actividad del contenido del archivo.</p>
                      <p className="text-xs text-gray-400">Los datos visibles se limitan a la identificación del vehículo/conductor.</p>
                    </div>
                  )}
                </div>

                {/* Warnings */}
                {(() => {
                  const warnings = typeof selectedImport.warningsJson === 'string' ? JSON.parse(selectedImport.warningsJson || '[]') : (selectedImport.warningsJson || []);
                  return warnings.length > 0 && (
                    <div>
                      <h3 className="font-bold text-orange-700 mb-2 text-sm">Avisos ({warnings.length})</h3>
                      <ul className="space-y-1">
                        {warnings.map((w: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 p-2 rounded">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Errors */}
                {(() => {
                  const errors = typeof selectedImport.errorsJson === 'string' ? JSON.parse(selectedImport.errorsJson || '[]') : (selectedImport.errorsJson || []);
                  return errors.length > 0 && (
                    <div>
                      <h3 className="font-bold text-red-700 mb-2 text-sm">Errores ({errors.length})</h3>
                      <ul className="space-y-1">
                        {errors.map((e: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                            <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{e}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                {/* Incidents */}
                {selectedImport.incidents?.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2 text-sm">Incidencias ({selectedImport.incidents.length})</h3>
                    <div className="space-y-1">
                      {selectedImport.incidents.map((inc: any) => (
                        <div key={inc.id} className={`flex items-center gap-3 p-2 rounded text-xs ${inc.resolutionStatus === 'RESOLVED' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                          {inc.resolutionStatus === 'RESOLVED' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                          <span className="font-medium">{inc.title}</span>
                          <span className="ml-auto px-2 py-0.5 rounded bg-white/50 border">{inc.severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-all">{value}</p>
    </div>
  );
}
