/**
 * regulation-evaluator.ts — Evaluadores por regla (Fase 1A)
 * 
 * Evalúa 4 reglas de tiempos de conducción del CE 561/2006:
 * - BREAK_AFTER_4H30 (Art. 7)
 * - DAILY_DRIVING_LIMIT (Art. 6.1, contextualizado en semana)
 * - WEEKLY_DRIVING_LIMIT (Art. 6.2)
 * - FORTNIGHT_DRIVING_LIMIT (Art. 6.3)
 */

import {
  REGULATION_RULES,
  BREAK_INTERRUPTING_ACTIVITIES,
  weekKey,
  getISOWeekStart,
  getISOWeekEnd,
  type FindingResult,
  type FindingSeverity,
} from './regulation-rules';
import type { DaySummaryForEval } from './regulation-confidence';

// ====================================
// Tipos de entrada
// ====================================

export interface NormalizedEventForEval {
  id: number;
  startAtUtc: Date;
  endAtUtc: Date;
  operationalDayLocal: Date;
  normalizedActivityType: string;
  durationMinutes: number;
  consolidationStatus: string;
  confidenceLevel: string;
}

export type { DaySummaryForEval } from './regulation-confidence';

// ====================================
// Tipos de salida
// ====================================

export interface RawFinding {
  ruleCode: string;
  ruleCategory: string;
  dateFrom: Date;
  dateTo: Date;
  result: FindingResult;
  severity: FindingSeverity;
  minutesObserved: number | null;
  minutesRequired: number | null;
  minutesExceeded: number | null;
  sourceEventIds: number[];
  explanation: string;
  isBlockingDataGap: boolean;
}

// ====================================
// 1. BREAK_AFTER_4H30 (Art. 7)
// ====================================

/**
 * Detecta secuencias de conducción continua > 4h30min sin pausa reglamentaria.
 * 
 * Lógica:
 * - Recorre eventos en orden cronológico
 * - Acumula minutos de DRIVING consecutivos
 * - Solo REST y BREAK ≥ 45 min (o split 15+30) resetean el contador
 * - OTHER_WORK y AVAILABILITY NO interrumpen la conducción continua
 * - Cuando se supera 270 min sin pausa adecuada → NON_COMPLIANT
 */
export function evaluateBreakAfter4H30(events: NormalizedEventForEval[]): RawFinding[] {
  const findings: RawFinding[] = [];
  const rule = REGULATION_RULES.BREAK_AFTER_4H30;
  const maxDrivingMin = rule.thresholds.maxContinuousDrivingMin;
  const requiredBreakMin = rule.thresholds.requiredBreakMin;
  const splitFirst = rule.thresholds.splitBreakFirstMin;
  const splitSecond = rule.thresholds.splitBreakSecondMin;

  // Solo eventos no excluidos, ordenados cronológicamente
  const sorted = events
    .filter(e => e.consolidationStatus !== 'excluded')
    .sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());

  let continuousDrivingMin = 0;
  let drivingStartEvent: NormalizedEventForEval | null = null;
  let currentSessionEvents: number[] = [];
  let partialBreakMin = 0; // Para split breaks
  let hadFirstSplit = false; // ¿Ya se tomó la primera parte del split (≥15min)?

  for (const event of sorted) {
    if (event.normalizedActivityType === 'DRIVING') {
      if (!drivingStartEvent) drivingStartEvent = event;
      continuousDrivingMin += event.durationMinutes;
      currentSessionEvents.push(event.id);

      if (continuousDrivingMin > maxDrivingMin) {
        findings.push({
          ruleCode: 'BREAK_AFTER_4H30',
          ruleCategory: 'BREAK_TIME',
          dateFrom: drivingStartEvent.startAtUtc,
          dateTo: event.endAtUtc,
          result: 'NON_COMPLIANT',
          severity: 'VIOLATION',
          minutesObserved: continuousDrivingMin,
          minutesRequired: maxDrivingMin,
          minutesExceeded: continuousDrivingMin - maxDrivingMin,
          sourceEventIds: [...currentSessionEvents],
          explanation: `${rule.article}: conducción continua de ${formatMinutes(continuousDrivingMin)} sin pausa reglamentaria. Se requiere interrupción de ≥${requiredBreakMin} min (o split ${splitFirst}+${splitSecond} min) tras ${formatMinutes(maxDrivingMin)} de conducción.`,
          isBlockingDataGap: false,
        });

        // Reset — start counting from this point
        continuousDrivingMin = 0;
        drivingStartEvent = null;
        currentSessionEvents = [];
        partialBreakMin = 0;
        hadFirstSplit = false;
      }
    } else if (isBreakActivity(event.normalizedActivityType)) {
      // Check if this break is sufficient
      if (event.durationMinutes >= requiredBreakMin) {
        // Full break — reset counter, emit COMPLIANT if there was driving
        if (continuousDrivingMin > 0 && drivingStartEvent) {
          findings.push({
            ruleCode: 'BREAK_AFTER_4H30',
            ruleCategory: 'BREAK_TIME',
            dateFrom: drivingStartEvent.startAtUtc,
            dateTo: event.endAtUtc,
            result: 'COMPLIANT',
            severity: 'INFO',
            minutesObserved: continuousDrivingMin,
            minutesRequired: maxDrivingMin,
            minutesExceeded: null,
            sourceEventIds: [...currentSessionEvents, event.id],
            explanation: `${rule.article}: conducción de ${formatMinutes(continuousDrivingMin)} seguida de pausa de ${event.durationMinutes} min. Cumple.`,
            isBlockingDataGap: false,
          });
        }
        continuousDrivingMin = 0;
        drivingStartEvent = null;
        currentSessionEvents = [];
        partialBreakMin = 0;
        hadFirstSplit = false;
      } else if (!hadFirstSplit && event.durationMinutes >= splitFirst) {
        // First part of split break (≥15min)
        hadFirstSplit = true;
        partialBreakMin = event.durationMinutes;
        currentSessionEvents.push(event.id);
      } else if (hadFirstSplit && event.durationMinutes >= splitSecond) {
        // Second part of split break (≥30min after a ≥15min)
        // This completes the split — reset
        if (drivingStartEvent) {
          findings.push({
            ruleCode: 'BREAK_AFTER_4H30',
            ruleCategory: 'BREAK_TIME',
            dateFrom: drivingStartEvent.startAtUtc,
            dateTo: event.endAtUtc,
            result: 'COMPLIANT',
            severity: 'INFO',
            minutesObserved: continuousDrivingMin,
            minutesRequired: maxDrivingMin,
            minutesExceeded: null,
            sourceEventIds: [...currentSessionEvents, event.id],
            explanation: `${rule.article}: conducción de ${formatMinutes(continuousDrivingMin)} con pausa dividida (${partialBreakMin}+${event.durationMinutes} min). Cumple.`,
            isBlockingDataGap: false,
          });
        }
        continuousDrivingMin = 0;
        drivingStartEvent = null;
        currentSessionEvents = [];
        partialBreakMin = 0;
        hadFirstSplit = false;
      } else {
        // Break too short to count
        currentSessionEvents.push(event.id);
      }
    }
    // OTHER_WORK and AVAILABILITY: do NOT reset the counter
  }

  return findings;
}

// ====================================
// 2. DAILY_DRIVING_LIMIT (Art. 6.1)
// ====================================

/**
 * Evalúa el límite de conducción diario contextualizado en la semana.
 * 
 * Un día con >540 min no es automáticamente NON_COMPLIANT si aún
 * hay extensiones disponibles esa semana (máximo 2 extensiones a 600 min).
 * Un día con >600 min es SIEMPRE NON_COMPLIANT.
 */
export function evaluateDailyDrivingLimit(
  summaries: DaySummaryForEval[],
  events: NormalizedEventForEval[],
): RawFinding[] {
  const findings: RawFinding[] = [];
  const rule = REGULATION_RULES.DAILY_DRIVING_LIMIT;
  const normalLimit = rule.thresholds.normalLimitMin;
  const extendedLimit = rule.thresholds.extendedLimitMin;
  const maxExtensions = rule.thresholds.maxExtensionsPerWeek;

  // Agrupar días por semana ISO
  const weekDays = new Map<string, DaySummaryForEval[]>();
  for (const day of summaries) {
    const d = new Date(day.date + 'T00:00:00Z');
    const wk = weekKey(d);
    if (!weekDays.has(wk)) weekDays.set(wk, []);
    weekDays.get(wk)!.push(day);
  }

  // Agrupar eventos por día operativo
  const eventsByDay = new Map<string, NormalizedEventForEval[]>();
  for (const e of events) {
    const dayStr = e.operationalDayLocal.toISOString().substring(0, 10);
    if (!eventsByDay.has(dayStr)) eventsByDay.set(dayStr, []);
    eventsByDay.get(dayStr)!.push(e);
  }

  // Evaluar cada semana
  for (const [wk, days] of weekDays) {
    // Ordenar dias cronológicamente
    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
    
    // Días que exceden el límite normal (>540) pero no el extendido (≤600)
    const extensionDays = sortedDays.filter(
      d => d.totalDrivingMinutes > normalLimit && d.totalDrivingMinutes <= extendedLimit
    );
    
    // Consumir extensiones en orden cronológico
    let extensionsUsed = 0;

    for (const day of sortedDays) {
      const dayDate = new Date(day.date + 'T00:00:00Z');
      const dayEndDate = new Date(day.date + 'T23:59:59Z');
      const dayEvents = eventsByDay.get(day.date) || [];
      const drivingEventIds = dayEvents
        .filter(e => e.normalizedActivityType === 'DRIVING')
        .map(e => e.id);

      if (day.totalDrivingMinutes <= normalLimit) {
        // Dentro del límite normal → COMPLIANT
        findings.push({
          ruleCode: 'DAILY_DRIVING_LIMIT',
          ruleCategory: 'DRIVING_TIME',
          dateFrom: dayDate,
          dateTo: dayEndDate,
          result: 'COMPLIANT',
          severity: 'INFO',
          minutesObserved: day.totalDrivingMinutes,
          minutesRequired: normalLimit,
          minutesExceeded: null,
          sourceEventIds: drivingEventIds,
          explanation: `${rule.article}: conducción diaria de ${formatMinutes(day.totalDrivingMinutes)} (límite: ${formatMinutes(normalLimit)}). Cumple.`,
          isBlockingDataGap: false,
        });
      } else if (day.totalDrivingMinutes <= extendedLimit) {
        // Entre 540 y 600 → ¿hay extensión disponible?
        extensionsUsed++;
        if (extensionsUsed <= maxExtensions) {
          findings.push({
            ruleCode: 'DAILY_DRIVING_LIMIT',
            ruleCategory: 'DRIVING_TIME',
            dateFrom: dayDate,
            dateTo: dayEndDate,
            result: 'COMPLIANT',
            severity: 'WARNING',
            minutesObserved: day.totalDrivingMinutes,
            minutesRequired: normalLimit,
            minutesExceeded: day.totalDrivingMinutes - normalLimit,
            sourceEventIds: drivingEventIds,
            explanation: `${rule.article}: conducción diaria de ${formatMinutes(day.totalDrivingMinutes)} (límite normal: ${formatMinutes(normalLimit)}). Extensión ${extensionsUsed}/${maxExtensions} usada esta semana (${wk}). Cumple.`,
            isBlockingDataGap: false,
          });
        } else {
          // Sin extensiones disponibles → NON_COMPLIANT
          findings.push({
            ruleCode: 'DAILY_DRIVING_LIMIT',
            ruleCategory: 'DRIVING_TIME',
            dateFrom: dayDate,
            dateTo: dayEndDate,
            result: 'NON_COMPLIANT',
            severity: 'VIOLATION',
            minutesObserved: day.totalDrivingMinutes,
            minutesRequired: normalLimit,
            minutesExceeded: day.totalDrivingMinutes - normalLimit,
            sourceEventIds: drivingEventIds,
            explanation: `${rule.article}: conducción diaria de ${formatMinutes(day.totalDrivingMinutes)} excede ${formatMinutes(normalLimit)}. Las ${maxExtensions} extensiones semanales ya fueron consumidas en ${wk}.`,
            isBlockingDataGap: false,
          });
        }
      } else {
        // >600 min → SIEMPRE NON_COMPLIANT
        extensionsUsed++; // Consume una extensión igualmente
        findings.push({
          ruleCode: 'DAILY_DRIVING_LIMIT',
          ruleCategory: 'DRIVING_TIME',
          dateFrom: dayDate,
          dateTo: dayEndDate,
          result: 'NON_COMPLIANT',
          severity: 'VIOLATION',
          minutesObserved: day.totalDrivingMinutes,
          minutesRequired: extendedLimit,
          minutesExceeded: day.totalDrivingMinutes - extendedLimit,
          sourceEventIds: drivingEventIds,
          explanation: `${rule.article}: conducción diaria de ${formatMinutes(day.totalDrivingMinutes)} excede el máximo absoluto de ${formatMinutes(extendedLimit)}.`,
          isBlockingDataGap: false,
        });
      }
    }
  }

  return findings;
}

// ====================================
// 3. WEEKLY_DRIVING_LIMIT (Art. 6.2)
// ====================================

/**
 * Evalúa el límite semanal de 56h de conducción por semana ISO.
 */
export function evaluateWeeklyDrivingLimit(
  summaries: DaySummaryForEval[],
): RawFinding[] {
  const findings: RawFinding[] = [];
  const rule = REGULATION_RULES.WEEKLY_DRIVING_LIMIT;
  const maxWeekly = rule.thresholds.maxWeeklyMin;

  // Agrupar por semana ISO
  const weekData = new Map<string, { totalDriving: number; dateFrom: Date; dateTo: Date }>();
  
  for (const day of summaries) {
    const d = new Date(day.date + 'T00:00:00Z');
    const wk = weekKey(d);
    
    if (!weekData.has(wk)) {
      weekData.set(wk, {
        totalDriving: 0,
        dateFrom: getISOWeekStart(d),
        dateTo: getISOWeekEnd(d),
      });
    }
    weekData.get(wk)!.totalDriving += day.totalDrivingMinutes;
  }

  for (const [wk, data] of weekData) {
    const result: FindingResult = data.totalDriving > maxWeekly ? 'NON_COMPLIANT' : 'COMPLIANT';
    const severity: FindingSeverity = data.totalDriving > maxWeekly ? 'VIOLATION' : 'INFO';

    findings.push({
      ruleCode: 'WEEKLY_DRIVING_LIMIT',
      ruleCategory: 'DRIVING_TIME',
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      result,
      severity,
      minutesObserved: data.totalDriving,
      minutesRequired: maxWeekly,
      minutesExceeded: data.totalDriving > maxWeekly ? data.totalDriving - maxWeekly : null,
      sourceEventIds: [], // Se rellenará en engine con los IDs por semana
      explanation: result === 'COMPLIANT'
        ? `${rule.article}: conducción semanal de ${formatMinutes(data.totalDriving)} en ${wk} (límite: ${formatMinutes(maxWeekly)}). Cumple.`
        : `${rule.article}: conducción semanal de ${formatMinutes(data.totalDriving)} en ${wk} excede el límite de ${formatMinutes(maxWeekly)}.`,
      isBlockingDataGap: false,
    });
  }

  return findings;
}

// ====================================
// 4. FORTNIGHT_DRIVING_LIMIT (Art. 6.3)
// ====================================

/**
 * Evalúa el límite bisemanal de 90h de conducción (dos semanas ISO consecutivas).
 */
export function evaluateFortnightDrivingLimit(
  summaries: DaySummaryForEval[],
): RawFinding[] {
  const findings: RawFinding[] = [];
  const rule = REGULATION_RULES.FORTNIGHT_DRIVING_LIMIT;
  const maxFortnight = rule.thresholds.maxFortnightMin;

  // Agrupar por semana ISO
  const weekTotals = new Map<string, { totalDriving: number; dateFrom: Date; dateTo: Date }>();
  
  for (const day of summaries) {
    const d = new Date(day.date + 'T00:00:00Z');
    const wk = weekKey(d);
    if (!weekTotals.has(wk)) {
      weekTotals.set(wk, {
        totalDriving: 0,
        dateFrom: getISOWeekStart(d),
        dateTo: getISOWeekEnd(d),
      });
    }
    weekTotals.get(wk)!.totalDriving += day.totalDrivingMinutes;
  }

  // Ordenar semanas
  const sortedWeeks = [...weekTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Evaluar cada par consecutivo
  for (let i = 0; i < sortedWeeks.length - 1; i++) {
    const [wk1, data1] = sortedWeeks[i];
    const [wk2, data2] = sortedWeeks[i + 1];
    
    // Verificar que son semanas consecutivas
    const week1End = data1.dateTo;
    const week2Start = data2.dateFrom;
    const daysBetween = (week2Start.getTime() - week1End.getTime()) / (1000 * 86400);
    if (daysBetween > 2) continue; // No son consecutivas

    const totalDriving = data1.totalDriving + data2.totalDriving;
    const result: FindingResult = totalDriving > maxFortnight ? 'NON_COMPLIANT' : 'COMPLIANT';
    const severity: FindingSeverity = totalDriving > maxFortnight ? 'VIOLATION' : 'INFO';

    findings.push({
      ruleCode: 'FORTNIGHT_DRIVING_LIMIT',
      ruleCategory: 'DRIVING_TIME',
      dateFrom: data1.dateFrom,
      dateTo: data2.dateTo,
      result,
      severity,
      minutesObserved: totalDriving,
      minutesRequired: maxFortnight,
      minutesExceeded: totalDriving > maxFortnight ? totalDriving - maxFortnight : null,
      sourceEventIds: [],
      explanation: result === 'COMPLIANT'
        ? `${rule.article}: conducción bisemanal de ${formatMinutes(totalDriving)} en ${wk1}+${wk2} (límite: ${formatMinutes(maxFortnight)}). Cumple.`
        : `${rule.article}: conducción bisemanal de ${formatMinutes(totalDriving)} en ${wk1}+${wk2} excede el límite de ${formatMinutes(maxFortnight)}.`,
      isBlockingDataGap: false,
    });
  }

  return findings;
}

// ====================================
// Helpers
// ====================================

function isBreakActivity(activityType: string): boolean {
  return (BREAK_INTERRUPTING_ACTIVITIES as readonly string[]).includes(activityType);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
