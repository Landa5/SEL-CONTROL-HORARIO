/**
 * regulation-confidence.ts — Evaluabilidad y confianza
 * 
 * Determina si un rango de fechas es evaluable para una regla normativa,
 * basándose en el dayConsolidationStatus de los DailySummary involucrados.
 */

import type { Evaluability, FindingConfidence } from './regulation-rules';

// ====================================
// Tipos
// ====================================

export interface EvaluabilityResult {
  evaluability: Evaluability;
  confidence: FindingConfidence;
  validDays: number;
  totalDays: number;
  blockedDays: string[];       // Fechas YYYY-MM-DD con dayConsolidationStatus BLOCKED_*
  partialDays: string[];       // Fechas con datos parciales o baja confianza
  gapDays: string[];           // Fechas sin datos en el rango
  reason: string;
}

export interface DaySummaryForEval {
  date: string;                 // YYYY-MM-DD
  dayConsolidationStatus: string;
  averageConfidence: string;
  totalDrivingMinutes: number;
  calendarCoverageRatio: number;
}

// ====================================
// Evaluabilidad Principal
// ====================================

/**
 * Evalúa si un rango de fechas tiene datos suficientes para emitir un resultado normativo.
 * 
 * @param summaries - DailySummary[] del rango evaluado (puede tener huecos)
 * @param dateFrom - Inicio del rango (inclusive)
 * @param dateTo - Fin del rango (inclusive)
 * @returns EvaluabilityResult con el nivel de evaluabilidad y confianza
 */
export function assessEvaluability(
  summaries: DaySummaryForEval[],
  dateFrom: Date,
  dateTo: Date,
): EvaluabilityResult {
  // Generar todas las fechas del rango
  const allDates = generateDateRange(dateFrom, dateTo);
  const summaryByDate = new Map(summaries.map(s => [s.date, s]));
  
  const validDays: string[] = [];
  const blockedDays: string[] = [];
  const partialDays: string[] = [];
  const gapDays: string[] = [];
  
  for (const dateStr of allDates) {
    const summary = summaryByDate.get(dateStr);
    
    if (!summary) {
      gapDays.push(dateStr);
      continue;
    }
    
    switch (summary.dayConsolidationStatus) {
      case 'VALID':
        if (summary.averageConfidence === 'low') {
          partialDays.push(dateStr);
        } else {
          validDays.push(dateStr);
        }
        break;
      case 'PARTIAL':
        partialDays.push(dateStr);
        break;
      case 'BLOCKED_NO_SOURCE':
      case 'BLOCKED_CONFLICT':
      case 'BLOCKED_LOW_CONFIDENCE':
        blockedDays.push(dateStr);
        break;
      default:
        partialDays.push(dateStr);
    }
  }
  
  const totalDays = allDates.length;
  const validCount = validDays.length;
  const blockedCount = blockedDays.length + gapDays.length;
  const validRatio = totalDays > 0 ? validCount / totalDays : 0;
  
  // Determinar evaluabilidad
  let evaluability: Evaluability;
  let confidence: FindingConfidence;
  let reason: string;
  
  if (blockedCount === 0 && partialDays.length === 0) {
    // Todos los días son VALID con confianza ≥ medium
    evaluability = 'EVALUABLE';
    confidence = 'HIGH';
    reason = `${validCount}/${totalDays} días con datos completos y válidos.`;
  } else if (validRatio >= 0.5 && blockedCount <= Math.floor(totalDays * 0.3)) {
    // ≥50% válidos, ≤30% bloqueados → evaluable parcialmente
    evaluability = 'PARTIALLY_EVALUABLE';
    confidence = gapDays.length > 0 ? 'LOW' : 'MEDIUM';
    const issues: string[] = [];
    if (blockedDays.length > 0) issues.push(`${blockedDays.length} días bloqueados`);
    if (gapDays.length > 0) issues.push(`${gapDays.length} días sin datos`);
    if (partialDays.length > 0) issues.push(`${partialDays.length} días parciales`);
    reason = `${validCount}/${totalDays} días válidos. ${issues.join(', ')}.`;
  } else {
    // Datos insuficientes
    evaluability = 'NOT_EVALUABLE';
    confidence = 'LOW';
    reason = `Solo ${validCount}/${totalDays} días válidos. ${blockedDays.length} bloqueados, ${gapDays.length} sin datos.`;
  }
  
  return {
    evaluability,
    confidence,
    validDays: validCount,
    totalDays,
    blockedDays,
    partialDays,
    gapDays,
    reason,
  };
}

/**
 * Determina el resultado máximo permitido según la evaluabilidad.
 * Si NOT_EVALUABLE → solo puede ser NOT_EVALUABLE.
 * Si PARTIALLY_EVALUABLE → máximo POTENTIAL_NON_COMPLIANCE.
 * Si EVALUABLE → cualquier resultado.
 */
export function capResultByEvaluability(
  rawResult: string,
  evaluability: Evaluability,
): string {
  if (evaluability === 'NOT_EVALUABLE') {
    return 'NOT_EVALUABLE';
  }
  if (evaluability === 'PARTIALLY_EVALUABLE') {
    if (rawResult === 'NON_COMPLIANT') {
      return 'POTENTIAL_NON_COMPLIANCE';
    }
  }
  return rawResult;
}

// ====================================
// Helpers
// ====================================

function generateDateRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  const current = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  
  while (current <= end) {
    dates.push(current.toISOString().substring(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return dates;
}
