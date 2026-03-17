/**
 * regulation-engine.ts — Motor principal de evaluación normativa
 * 
 * Coordina la evaluación de reglas CE 561/2006 sobre eventos normalizados.
 * 
 * Flujo:
 * 1. Genera evaluationRunId (UUID)
 * 2. Carga eventos normalizados + daily summaries del rango
 * 3. Calcula evaluabilidad por rango y por regla
 * 4. Ejecuta evaluadores Fase 1A
 * 5. Aplica capa de confianza
 * 6. Borra findings anteriores del mismo run
 * 7. Persiste nuevos findings
 * 8. Retorna resumen
 */

import { prisma, withWriteClient } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { assessEvaluability } from './regulation-confidence';
import {
  evaluateBreakAfter4H30,
  evaluateDailyDrivingLimit,
  evaluateWeeklyDrivingLimit,
  evaluateFortnightDrivingLimit,
  type NormalizedEventForEval,
  type DaySummaryForEval,
  type RawFinding,
} from './regulation-evaluator';
import { applyEvaluabilityToFindings, type PersistedFinding } from './regulation-findings';
import { getISOWeekStart, getISOWeekEnd } from './regulation-rules';

// ====================================
// Tipos de resultado
// ====================================

export interface RegulationResult {
  evaluationRunId: string;
  driverId: number;
  dateFrom: Date;
  dateTo: Date;
  totalFindings: number;
  findings: PersistedFinding[];
  summary: {
    compliant: number;
    nonCompliant: number;
    potentialNonCompliance: number;
    notEvaluable: number;
  };
  evaluabilityReport: {
    evaluability: string;
    confidence: string;
    validDays: number;
    totalDays: number;
    blockedDays: string[];
    gapDays: string[];
    reason: string;
  };
  durationMs: number;
}

// ====================================
// Motor principal
// ====================================

export async function evaluateRegulations(
  driverId: number,
  dateFrom: Date,
  dateTo: Date,
): Promise<RegulationResult> {
  const startTime = Date.now();
  const evaluationRunId = randomUUID();

  // 1. Cargar eventos normalizados del conductor en el rango
  const events = await prisma.tachographNormalizedEvent.findMany({
    where: {
      driverId,
      startAtUtc: { gte: dateFrom },
      endAtUtc: { lte: new Date(dateTo.getTime() + 86400000) }, // +1 día de margen
      consolidationStatus: { not: 'excluded' },
    },
    orderBy: { startAtUtc: 'asc' },
  });

  const eventsForEval: NormalizedEventForEval[] = events.map((e: any) => ({
    id: e.id,
    startAtUtc: e.startAtUtc,
    endAtUtc: e.endAtUtc,
    operationalDayLocal: e.operationalDayLocal,
    normalizedActivityType: e.normalizedActivityType,
    durationMinutes: e.durationMinutes,
    consolidationStatus: e.consolidationStatus,
    confidenceLevel: e.confidenceLevel,
  }));

  // 2. Cargar daily summaries
  const summaries = await prisma.tachographDailySummary.findMany({
    where: {
      driverId,
      date: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { date: 'asc' },
  });

  const summariesForEval: DaySummaryForEval[] = summaries.map((s: any) => ({
    date: s.date.toISOString().substring(0, 10),
    totalDrivingMinutes: s.totalDrivingMinutes,
    dayConsolidationStatus: s.dayConsolidationStatus,
    averageConfidence: s.averageConfidence,
    calendarCoverageRatio: s.calendarCoverageRatio,
  }));

  // 3. Evaluar evaluabilidad global
  const globalEval = assessEvaluability(summariesForEval, dateFrom, dateTo);

  // 4. Ejecutar evaluadores Fase 1A
  const allRawFindings: RawFinding[] = [];

  // BREAK_AFTER_4H30: usa secuencia continua de eventos
  const breakFindings = evaluateBreakAfter4H30(eventsForEval);
  allRawFindings.push(...breakFindings);

  // DAILY_DRIVING_LIMIT: contextualizado en semana
  const dailyFindings = evaluateDailyDrivingLimit(summariesForEval, eventsForEval);
  allRawFindings.push(...dailyFindings);

  // WEEKLY_DRIVING_LIMIT
  const weeklyFindings = evaluateWeeklyDrivingLimit(summariesForEval);
  // Enriquecer con sourceEventIds por semana
  for (const f of weeklyFindings) {
    const weekEvents = eventsForEval.filter(e =>
      e.normalizedActivityType === 'DRIVING' &&
      e.startAtUtc >= f.dateFrom &&
      e.endAtUtc <= new Date(f.dateTo.getTime() + 86400000)
    );
    f.sourceEventIds = weekEvents.map(e => e.id);
  }
  allRawFindings.push(...weeklyFindings);

  // FORTNIGHT_DRIVING_LIMIT
  const fortnightFindings = evaluateFortnightDrivingLimit(summariesForEval);
  for (const f of fortnightFindings) {
    const periodEvents = eventsForEval.filter(e =>
      e.normalizedActivityType === 'DRIVING' &&
      e.startAtUtc >= f.dateFrom &&
      e.endAtUtc <= new Date(f.dateTo.getTime() + 86400000)
    );
    f.sourceEventIds = periodEvents.map(e => e.id);
  }
  allRawFindings.push(...fortnightFindings);

  // 5. Aplicar evaluabilidad a cada finding
  const allPersistedFindings: PersistedFinding[] = [];

  for (const raw of allRawFindings) {
    // Calcular evaluabilidad específica para el rango de este finding
    const findingSummaries = summariesForEval.filter(s => {
      const d = new Date(s.date + 'T00:00:00Z');
      return d >= raw.dateFrom && d <= raw.dateTo;
    });
    const localEval = assessEvaluability(findingSummaries, raw.dateFrom, raw.dateTo);

    const persisted = applyEvaluabilityToFindings(
      [raw], localEval, driverId, evaluationRunId
    );
    allPersistedFindings.push(...persisted);
  }

  // 6. Borrar findings anteriores y persistir nuevos (operaciones de escritura)
  await withWriteClient(async (writeClient) => {
    await writeClient.tachographRegulationFinding.deleteMany({
      where: {
        driverId,
        dateFrom: { gte: dateFrom },
        dateTo: { lte: new Date(dateTo.getTime() + 86400000) },
      },
    });

    if (allPersistedFindings.length > 0) {
      await writeClient.tachographRegulationFinding.createMany({
        data: allPersistedFindings.map(f => ({
          driverId: f.driverId,
          vehicleId: f.vehicleId,
          dateFrom: f.dateFrom,
          dateTo: f.dateTo,
          ruleCode: f.ruleCode,
          ruleCategory: f.ruleCategory,
          severity: f.severity,
          evaluability: f.evaluability,
          result: f.result,
          confidence: f.confidence,
          minutesObserved: f.minutesObserved,
          minutesRequired: f.minutesRequired,
          minutesExceeded: f.minutesExceeded,
          sourceEventIds: f.sourceEventIds,
          explanation: f.explanation,
          isBlockingDataGap: f.isBlockingDataGap,
          evaluationRunId: f.evaluationRunId,
          evaluationVersion: f.evaluationVersion,
        })),
      });
    }
  });

  // 8. Resumen
  const summary = {
    compliant: allPersistedFindings.filter(f => f.result === 'COMPLIANT').length,
    nonCompliant: allPersistedFindings.filter(f => f.result === 'NON_COMPLIANT').length,
    potentialNonCompliance: allPersistedFindings.filter(f => f.result === 'POTENTIAL_NON_COMPLIANCE').length,
    notEvaluable: allPersistedFindings.filter(f => f.result === 'NOT_EVALUABLE').length,
  };

  return {
    evaluationRunId,
    driverId,
    dateFrom,
    dateTo,
    totalFindings: allPersistedFindings.length,
    findings: allPersistedFindings,
    summary,
    evaluabilityReport: {
      evaluability: globalEval.evaluability,
      confidence: globalEval.confidence,
      validDays: globalEval.validDays,
      totalDays: globalEval.totalDays,
      blockedDays: globalEval.blockedDays,
      gapDays: globalEval.gapDays,
      reason: globalEval.reason,
    },
    durationMs: Date.now() - startTime,
  };
}
