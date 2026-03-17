/**
 * regulation-findings.ts — Generación y persistencia de findings
 * 
 * Aplica evaluabilidad de confianza a los raw findings del evaluator
 * y los persiste como TachographRegulationFinding.
 */

import type { RawFinding } from './regulation-evaluator';
import type { EvaluabilityResult } from './regulation-confidence';
import { capResultByEvaluability } from './regulation-confidence';
import type { Evaluability, FindingConfidence, FindingResult, FindingSeverity } from './regulation-rules';

// ====================================
// Finding para persistir
// ====================================

export interface PersistedFinding {
  driverId: number;
  vehicleId: number | null;
  dateFrom: Date;
  dateTo: Date;
  ruleCode: string;
  ruleCategory: string;
  severity: string;
  evaluability: string;
  result: string;
  confidence: string;
  minutesObserved: number | null;
  minutesRequired: number | null;
  minutesExceeded: number | null;
  sourceEventIds: number[];
  explanation: string;
  isBlockingDataGap: boolean;
  evaluationRunId: string;
  evaluationVersion: string;
}

// ====================================
// Apply evaluability to raw findings
// ====================================

/**
 * Toma los raw findings del evaluator y les aplica la capa de evaluabilidad.
 * 
 * - NOT_EVALUABLE → resultado forzado a NOT_EVALUABLE, severidad INFO
 * - PARTIALLY_EVALUABLE → NON_COMPLIANT se degrada a POTENTIAL_NON_COMPLIANCE
 * - EVALUABLE → sin cambios
 */
export function applyEvaluabilityToFindings(
  rawFindings: RawFinding[],
  evalResult: EvaluabilityResult,
  driverId: number,
  evaluationRunId: string,
): PersistedFinding[] {
  return rawFindings.map(raw => {
    const cappedResult = capResultByEvaluability(raw.result, evalResult.evaluability);
    
    // Adjust severity if result was capped
    let severity = raw.severity;
    if (cappedResult === 'NOT_EVALUABLE') {
      severity = 'INFO';
    } else if (cappedResult === 'POTENTIAL_NON_COMPLIANCE' && raw.result === 'NON_COMPLIANT') {
      severity = 'WARNING';
    }

    // Adjust explanation if result was capped
    let explanation = raw.explanation;
    if (cappedResult !== raw.result) {
      explanation += ` [Resultado ajustado de ${raw.result} a ${cappedResult}: ${evalResult.reason}]`;
    }

    // Set isBlockingDataGap
    const isBlockingDataGap = evalResult.evaluability === 'NOT_EVALUABLE' && 
      (evalResult.blockedDays.length > 0 || evalResult.gapDays.length > 0);

    return {
      driverId,
      vehicleId: null,
      dateFrom: raw.dateFrom,
      dateTo: raw.dateTo,
      ruleCode: raw.ruleCode,
      ruleCategory: raw.ruleCategory,
      severity,
      evaluability: evalResult.evaluability,
      result: cappedResult,
      confidence: evalResult.confidence,
      minutesObserved: raw.minutesObserved,
      minutesRequired: raw.minutesRequired,
      minutesExceeded: raw.minutesExceeded,
      sourceEventIds: raw.sourceEventIds,
      explanation,
      isBlockingDataGap,
      evaluationRunId,
      evaluationVersion: 'reg-v1',
    };
  });
}

/**
 * Filtra findings para persistencia: elimina COMPLIANT con INFO
 * cuando no aportan valor (opcional, configurable).
 */
export function filterFindingsForPersistence(
  findings: PersistedFinding[],
  includeCompliant: boolean = true,
): PersistedFinding[] {
  if (includeCompliant) return findings;
  return findings.filter(f => f.result !== 'COMPLIANT');
}
