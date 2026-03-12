'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, Link2, Unlink, Users, Search, CreditCard } from 'lucide-react';

/**
 * Extract DNI from Spanish tachograph card number.
 * Spanish card format: E + 8 digits DNI + letter + 4 control digits
 * Example: E012345678A0001 → DNI: 12345678A
 * Also handles: E-12345678-A-0001 or similar variations
 */
function extractDniFromCard(cardNumber: string | null): string | null {
  if (!cardNumber) return null;
  // Remove spaces, dashes
  const clean = cardNumber.replace(/[\s\-\.]/g, '').toUpperCase();
  // Spanish card: starts with E, then 8-9 digits, then a letter
  const match = clean.match(/^E(\d{8,9}[A-Z])/);
  if (match) return match[1];
  // Try to find a DNI pattern anywhere (8 digits + letter)
  const dniMatch = clean.match(/(\d{8}[A-Z])/);
  if (dniMatch) return dniMatch[1];
  return null;
}

export default function ConductoresPage() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'linked'|'unlinked'>('all');
  const [linkingId, setLinkingId] = useState<number|null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number|0>(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?linked=${filter === 'linked'}` : '';
      const [driversRes, empRes] = await Promise.all([
        fetch(`/api/tacografo/drivers${params}`),
        fetch('/api/empleados?activos=true')
      ]);
      if (driversRes.ok) setDrivers(await driversRes.json());
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : empData.data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const linkDriver = async (driverId: number) => {
    if (!selectedEmployee) return;
    try {
      const res = await fetch(`/api/tacografo/drivers/${driverId}/link`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedEmployee })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error al vincular: ${err.error || 'Error desconocido'}`);
        return;
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
      return;
    }
    setLinkingId(null);
    setSelectedEmployee(0);
    fetchData();
  };

  const unlinkDriver = async (driverId: number) => {
    try {
      const res = await fetch(`/api/tacografo/drivers/${driverId}/link`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: null })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error al desvincular: ${err.error || 'Error desconocido'}`);
        return;
      }
    } catch (e: any) {
      alert(`Error de conexión: ${e.message}`);
      return;
    }
    fetchData();
  };

  // Filter employees for dropdown based on search
  const filteredEmployees = searchTerm
    ? employees.filter((e: any) => {
        const fullName = `${e.nombre} ${e.apellidos || ''} ${e.dni || ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      })
    : employees;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conductores</h1>
            <p className="text-sm text-gray-500">Conductores detectados en archivos de tacógrafo — vincula con empleados por DNI</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'linked', 'unlinked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f === 'all' ? 'Todos' : f === 'linked' ? 'Vinculados' : 'Sin vincular'}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500 flex items-center">{drivers.length} conductores</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div></div>
        ) : drivers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin conductores detectados</p>
            <p className="text-sm mt-1">Los conductores aparecerán aquí cuando se importen archivos de tacógrafo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b bg-gray-50/50">
                <th className="px-6 py-3">Nombre</th>
                <th className="px-6 py-3">DNI</th>
                <th className="px-6 py-3">Nº Tarjeta</th>
                <th className="px-6 py-3">Caducidad</th>
                <th className="px-6 py-3">Empleado vinculado</th>
                <th className="px-6 py-3">Imports</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drivers.map((d) => {
                const dni = extractDniFromCard(d.cardNumber);
                return (
                <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{d.fullName}</td>
                  <td className="px-6 py-4">
                    {dni ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                        <CreditCard className="w-3 h-3" />{dni}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-[11px]">{d.cardNumber || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{d.cardExpiry ? new Date(d.cardExpiry).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="px-6 py-4">
                    {d.linkedEmployee ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                          <Link2 className="w-3 h-3" />{d.linkedEmployee.nombre} {d.linkedEmployee.apellidos || ''}
                        </span>
                        {d.linkedEmployee.dni && (
                          <span className="block text-[10px] text-gray-400 font-mono mt-0.5 ml-1">DNI: {d.linkedEmployee.dni}</span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                        <Unlink className="w-3 h-3" />Sin vincular
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{d._count?.imports || 0}</td>
                  <td className="px-6 py-4 text-right">
                    {linkingId === d.id ? (
                      <div className="flex flex-col items-end gap-2">
                        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(parseInt(e.target.value))} className="text-xs border rounded-lg px-2 py-1.5 w-full max-w-[250px]">
                          <option value={0}>Seleccionar empleado...</option>
                          {employees.map((e: any) => (
                            <option key={e.id} value={e.id}>
                              {e.nombre} {e.apellidos || ''}{e.dni ? ` — DNI: ${e.dni}` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <button onClick={() => linkDriver(d.id)} disabled={!selectedEmployee} className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-blue-700">Vincular</button>
                          <button onClick={() => { setLinkingId(null); setSelectedEmployee(0); }} className="px-2.5 py-1.5 border rounded-lg text-xs hover:bg-gray-50">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        {d.linkedEmployee ? (
                          <button onClick={() => unlinkDriver(d.id)} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium">Desvincular</button>
                        ) : (
                          <button onClick={() => setLinkingId(d.id)} className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg font-medium flex items-center gap-1">
                            <Link2 className="w-3 h-3" />Vincular
                          </button>
                        )}
                      </div>
                    )}
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

