'use client';

import { useState, useEffect, useCallback } from 'react';

// ====================================
// Tipos
// ====================================

interface Finding {
  id: number;
  driverId: number;
  dateFrom: string;
  dateTo: string;
  ruleCode: string;
  ruleCategory: string;
  severity: string;
  evaluability: string;
  result: string;
  confidence: string;
  minutesObserved: number | null;
  minutesRequired: number | null;
  minutesExceeded: number | null;
  explanation: string;
  sourceEventIds: number[];
  isBlockingDataGap: boolean;
  evaluationRunId: string;
  createdAt: string;
  driver?: { id: number; fullName: string; cardNumber: string | null };
}

interface FindingsResponse {
  findings: Finding[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

// ====================================
// Helpers
// ====================================

const RESULT_COLORS: Record<string, string> = {
  COMPLIANT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  NON_COMPLIANT: 'bg-red-100 text-red-800 border-red-200',
  POTENTIAL_NON_COMPLIANCE: 'bg-amber-100 text-amber-800 border-amber-200',
  NOT_EVALUABLE: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'text-blue-600',
  WARNING: 'text-amber-600',
  VIOLATION: 'text-red-600 font-semibold',
};

const RULE_LABELS: Record<string, string> = {
  BREAK_AFTER_4H30: 'Pausa tras 4h30',
  DAILY_DRIVING_LIMIT: 'Conducción diaria',
  WEEKLY_DRIVING_LIMIT: 'Conducción semanal',
  FORTNIGHT_DRIVING_LIMIT: 'Conducción bisemanal',
  DAILY_REST_MINIMUM: 'Descanso diario',
};

const RESULT_LABELS: Record<string, string> = {
  COMPLIANT: 'Cumple',
  NON_COMPLIANT: 'Incumplimiento',
  POTENTIAL_NON_COMPLIANCE: 'Potencial incumplimiento',
  NOT_EVALUABLE: 'No evaluable',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function formatMinutes(min: number | null): string {
  if (min === null || min === undefined) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ====================================
// Componente Principal
// ====================================

export default function RegulacionPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evalResult, setEvalResult] = useState<any>(null);

  // Filters
  const [filterResult, setFilterResult] = useState('');
  const [filterRule, setFilterRule] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  // Drivers
  const [drivers, setDrivers] = useState<{ id: number; fullName: string }[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);

  // Date range for evaluation
  const [evalDateFrom, setEvalDateFrom] = useState('');
  const [evalDateTo, setEvalDateTo] = useState('');

  // Load drivers
  useEffect(() => {
    fetch('/api/tacografo/drivers')
      .then(r => r.json())
      .then(data => {
        const driverList = Array.isArray(data) ? data : data.drivers || [];
        setDrivers(driverList);
        if (driverList.length > 0 && !selectedDriver) {
          setSelectedDriver(driverList[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load findings
  const loadFindings = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (selectedDriver) params.set('driverId', String(selectedDriver));
    if (filterResult) params.set('result', filterResult);
    if (filterRule) params.set('ruleCode', filterRule);
    if (filterSeverity) params.set('severity', filterSeverity);
    params.set('page', String(pagination.page));
    params.set('pageSize', '50');

    try {
      const res = await fetch(`/api/tacografo/regulation?${params}`);
      if (!res.ok) throw new Error('Error cargando findings');
      const data: FindingsResponse = await res.json();
      setFindings(data.findings);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDriver, filterResult, filterRule, filterSeverity, pagination.page]);

  useEffect(() => {
    if (selectedDriver) loadFindings();
  }, [selectedDriver, filterResult, filterRule, filterSeverity, loadFindings]);

  // Trigger evaluation
  const handleEvaluate = async () => {
    if (!selectedDriver || !evalDateFrom || !evalDateTo) {
      setError('Selecciona conductor y rango de fechas');
      return;
    }

    setEvaluating(true);
    setError(null);
    setEvalResult(null);

    try {
      const res = await fetch('/api/tacografo/regulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriver,
          dateFrom: evalDateFrom,
          dateTo: evalDateTo,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error en evaluación');
      }
      const result = await res.json();
      setEvalResult(result);
      loadFindings();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regulación — CE 561/2006</h1>
          <p className="text-sm text-gray-500 mt-1">
            Motor normativo de tiempos de conducción y descanso
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Cumple" value={stats.COMPLIANT || 0} color="emerald" />
        <StatCard label="Incumplimiento" value={stats.NON_COMPLIANT || 0} color="red" />
        <StatCard label="Potencial" value={stats.POTENTIAL_NON_COMPLIANCE || 0} color="amber" />
        <StatCard label="No evaluable" value={stats.NOT_EVALUABLE || 0} color="gray" />
      </div>

      {/* Evaluation Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Evaluar cumplimiento</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={selectedDriver || ''}
            onChange={e => setSelectedDriver(parseInt(e.target.value) || null)}
          >
            <option value="">Seleccionar conductor</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={evalDateFrom}
            onChange={e => setEvalDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            value={evalDateTo}
            onChange={e => setEvalDateTo(e.target.value)}
          />
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="bg-blue-600 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {evaluating ? 'Evaluando...' : 'Evaluar'}
          </button>
        </div>

        {evalResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm space-y-1">
            <p className="font-medium text-blue-800">
              Evaluación completada en {evalResult.durationMs}ms — {evalResult.totalFindings} findings
            </p>
            <p className="text-blue-700">
              ✅ {evalResult.summary.compliant} cumple | 
              ❌ {evalResult.summary.nonCompliant} incumplimiento |
              ⚠️ {evalResult.summary.potentialNonCompliance} potencial |
              ◻️ {evalResult.summary.notEvaluable} no evaluable
            </p>
            <p className="text-blue-600 text-xs">
              Evaluabilidad: {evalResult.evaluabilityReport.evaluability} — 
              {evalResult.evaluabilityReport.validDays}/{evalResult.evaluabilityReport.totalDays} días válidos
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={filterResult}
          onChange={e => setFilterResult(e.target.value)}
        >
          <option value="">Todos los resultados</option>
          <option value="COMPLIANT">Cumple</option>
          <option value="NON_COMPLIANT">Incumplimiento</option>
          <option value="POTENTIAL_NON_COMPLIANCE">Potencial</option>
          <option value="NOT_EVALUABLE">No evaluable</option>
        </select>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={filterRule}
          onChange={e => setFilterRule(e.target.value)}
        >
          <option value="">Todas las reglas</option>
          <option value="BREAK_AFTER_4H30">Pausa tras 4h30</option>
          <option value="DAILY_DRIVING_LIMIT">Conducción diaria</option>
          <option value="WEEKLY_DRIVING_LIMIT">Conducción semanal</option>
          <option value="FORTNIGHT_DRIVING_LIMIT">Conducción bisemanal</option>
        </select>
        <select
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
        >
          <option value="">Todas las severidades</option>
          <option value="INFO">Info</option>
          <option value="WARNING">Aviso</option>
          <option value="VIOLATION">Infracción</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Findings Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : findings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay findings. Ejecuta una evaluación para generar resultados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600">Regla</th>
                <th className="px-4 py-3 font-medium text-gray-600">Resultado</th>
                <th className="px-4 py-3 font-medium text-gray-600">Severidad</th>
                <th className="px-4 py-3 font-medium text-gray-600">Observado</th>
                <th className="px-4 py-3 font-medium text-gray-600">Límite</th>
                <th className="px-4 py-3 font-medium text-gray-600">Exceso</th>
                <th className="px-4 py-3 font-medium text-gray-600">Eval.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {findings.map(f => (
                <>
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                  >
                    <td className="px-4 py-3 text-gray-800">
                      {formatDate(f.dateFrom)}
                      {f.dateFrom !== f.dateTo && ` — ${formatDate(f.dateTo)}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{RULE_LABELS[f.ruleCode] || f.ruleCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${RESULT_COLORS[f.result] || ''}`}>
                        {RESULT_LABELS[f.result] || f.result}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${SEVERITY_COLORS[f.severity] || ''}`}>
                      {f.severity}
                    </td>
                    <td className="px-4 py-3 text-gray-700 tabular-nums">
                      {formatMinutes(f.minutesObserved)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 tabular-nums">
                      {formatMinutes(f.minutesRequired)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {f.minutesExceeded ? (
                        <span className="text-red-600 font-medium">+{formatMinutes(f.minutesExceeded)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{f.evaluability}</td>
                  </tr>
                  {expandedId === f.id && (
                    <tr key={`${f.id}-detail`}>
                      <td colSpan={8} className="px-4 py-4 bg-gray-50">
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-700"><strong>Explicación:</strong> {f.explanation}</p>
                          <p className="text-gray-500 text-xs">
                            <strong>Confianza:</strong> {f.confidence} | 
                            <strong> Eventos fuente:</strong> {f.sourceEventIds.length} |
                            <strong> Run:</strong> {f.evaluationRunId.substring(0, 8)}... |
                            <strong> Gap bloqueante:</strong> {f.isBlockingDataGap ? 'Sí' : 'No'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{pagination.total} findings en total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="px-3 py-1">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================
// Sub-componentes
// ====================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color] || ''}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}
