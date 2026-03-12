'use client';

import React, { useState, useEffect } from 'react';
import { Truck, Link2, Unlink } from 'lucide-react';

export default function VehiculosPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [camiones, setCamiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'linked'|'unlinked'>('all');
  const [linkingId, setLinkingId] = useState<number|null>(null);
  const [selectedCamion, setSelectedCamion] = useState<number|0>(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?linked=${filter === 'linked'}` : '';
      const [vRes, cRes] = await Promise.all([
        fetch(`/api/tacografo/vehicles${params}`),
        fetch('/api/camiones')
      ]);
      if (vRes.ok) setVehicles(await vRes.json());
      if (cRes.ok) {
        const cData = await cRes.json();
        setCamiones(Array.isArray(cData) ? cData : cData.data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const linkVehicle = async (vehicleId: number) => {
    if (!selectedCamion) return;
    await fetch(`/api/tacografo/vehicles/${vehicleId}/link`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: selectedCamion })
    });
    setLinkingId(null);
    setSelectedCamion(0);
    fetchData();
  };

  const unlinkVehicle = async (vehicleId: number) => {
    await fetch(`/api/tacografo/vehicles/${vehicleId}/link`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleId: null })
    });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehículos</h1>
            <p className="text-sm text-gray-500">Vehículos detectados en archivos de tacógrafo</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'linked', 'unlinked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todos' : f === 'linked' ? 'Vinculados' : 'Sin vincular'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500">{vehicles.length} vehículos</span>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin vehículos detectados</p>
            <p className="text-sm mt-1">Los vehículos aparecerán aquí cuando se importen archivos</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                <th className="px-6 py-3">Matrícula</th>
                <th className="px-6 py-3">VIN</th>
                <th className="px-6 py-3">Marca Tacógrafo</th>
                <th className="px-6 py-3">Camión vinculado</th>
                <th className="px-6 py-3">Imports</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900 font-mono">{v.plateNumber || '—'}</td>
                  <td className="px-6 py-4 text-gray-600 font-mono text-xs">{v.vin || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{v.tachographBrand || '—'}</td>
                  <td className="px-6 py-4">
                    {v.linkedVehicle ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                        <Link2 className="w-3 h-3" />{v.linkedVehicle.matricula} — {v.linkedVehicle.marca} {v.linkedVehicle.modelo || ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                        <Unlink className="w-3 h-3" />Sin vincular
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{v._count?.imports || 0}</td>
                  <td className="px-6 py-4 text-right">
                    {linkingId === v.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <select value={selectedCamion} onChange={(e) => setSelectedCamion(parseInt(e.target.value))} className="text-xs border rounded-lg px-2 py-1.5 max-w-[180px]">
                          <option value={0}>Seleccionar camión...</option>
                          {camiones.map((c: any) => <option key={c.id} value={c.id}>{c.matricula} — {c.marca} {c.modelo || ''}</option>)}
                        </select>
                        <button onClick={() => linkVehicle(v.id)} disabled={!selectedCamion} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-blue-700">Vincular</button>
                        <button onClick={() => { setLinkingId(null); setSelectedCamion(0); }} className="px-2.5 py-1.5 border rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        {v.linkedVehicle ? (
                          <button onClick={() => unlinkVehicle(v.id)} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium">Desvincular</button>
                        ) : (
                          <button onClick={() => setLinkingId(v.id)} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium flex items-center gap-1">
                            <Link2 className="w-3 h-3" />Vincular
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
