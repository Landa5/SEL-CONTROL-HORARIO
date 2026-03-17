/**
 * TachographNormalizer v2 — Normalización de eventos brutos a eventos operativos
 * 
 * Input: BinaryRawEvent[] (del parser)
 * Output: NormalizedEventData[] + DailySummary[] + Incident[]
 * 
 * Responsabilidades:
 *   - Convertir UTC → Europe/Madrid (operationalDayLocal)
 *   - Split medianoche LOCAL (no UTC)
 *   - Calcular fingerprint por evento (dedup)
 *   - Fusionar eventos solapados del mismo tipo
 *   - Rellenar huecos con REST
 *   - 4 dimensiones: extractionMethod, confidenceLevel, matchingStatus, consolidationStatus
 *   - Calcular resúmenes diarios
 *   - Detectar incidencias de regulación
 */

import crypto from 'crypto';
import type { BinaryRawEvent } from './tachograph-binary-parser';

// ====================================
// Tipos exportados
// ====================================

export type ActivityType = 'DRIVING' | 'OTHER_WORK' | 'AVAILABILITY' | 'REST' | 'BREAK' | 'UNKNOWN';

export interface NormalizedEventData {
  sourceType: string;
  startAtUtc: Date;
  endAtUtc: Date;
  startAtLocal: Date;
  endAtLocal: Date;
  operationalDayLocal: Date; // Solo fecha, sin hora
  normalizedActivityType: ActivityType;
  durationMinutes: number;
  extractionMethod: 'spec' | 'heuristic' | 'derived';
  confidenceLevel: 'high' | 'medium' | 'low';
  matchingStatus: 'matched' | 'unmatched' | 'pending_review' | 'manual';
  consolidationStatus: 'operative' | 'provisional' | 'excluded';
  consolidationReason: string;
  isSplitCrossMidnight: boolean;
  fingerprint: string;
  parentRawEventIndex: number; // Índice en el array de raw events para vincular
  rawDriverIdentifier: string | null;
  rawVehicleIdentifier: string | null;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD (local)
  totalDrivingMinutes: number;
  totalOtherWorkMinutes: number;
  totalAvailabilityMinutes: number;
  totalRestMinutes: number;
  totalBreakMinutes: number;
  gapMinutes: number;
  coveragePercent: number;
  consistencyStatus: 'pending' | 'ok' | 'warning' | 'error' | 'conflict';
  sourceDataOrigin: string | null;
  averageConfidence: 'low' | 'medium' | 'high';
  importedFromCount: number;

  // Desglose de cobertura
  ownSourceMinutes: number;
  inheritedSplitMinutes: number;
  rawEventsCount: number;

  // Ratios (SOLO DESCRIPTIVOS — no determinan consolidación)
  calendarCoverageRatio: number;  // (ownSource + inherited) / 1440
  totalCoverageRatio: number;     // = calendarCoverageRatio (sin gapFill)

  // Consolidación a nivel de día
  dayConsolidationStatus:
    | 'VALID'
    | 'PARTIAL'
    | 'BLOCKED_NO_SOURCE'
    | 'BLOCKED_CONFLICT'
    | 'BLOCKED_LOW_CONFIDENCE';
}

export interface RegulationIncident {
  type: string; // TachographIncidentType values
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  date: string;
  durationMinutes?: number;
}

export interface NormalizationResult {
  normalizedEvents: NormalizedEventData[];
  dailySummaries: DailySummary[];
  incidents: RegulationIncident[];
  warnings: string[];
}

// ====================================
// Timezone: UTC → Europe/Madrid
// ====================================

/**
 * Convierte una fecha UTC a hora local de España (Europe/Madrid).
 * Usa Intl.DateTimeFormat para manejar CET/CEST automáticamente.
 */
function utcToMadrid(utcDate: Date): Date {
  // Obtener la representación en Europe/Madrid
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  
  const year = parseInt(get('year'));
  const month = parseInt(get('month')) - 1;
  const day = parseInt(get('day'));
  const hour = parseInt(get('hour'));
  const minute = parseInt(get('minute'));
  const second = parseInt(get('second'));
  
  // Crear un Date que represente la hora local (guardamos como UTC para que Prisma lo persista correctamente)
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Obtiene la fecha operativa local (YYYY-MM-DD) en Europe/Madrid
 */
function getOperationalDayLocal(utcDate: Date): Date {
  const local = utcToMadrid(utcDate);
  return new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  ));
}

/**
 * Siguiente medianoche local (Europe/Madrid) después de una fecha UTC
 */
function nextLocalMidnight(utcDate: Date): Date {
  const local = utcToMadrid(utcDate);
  const nextDay = new Date(Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
    0, 0, 0
  ));
  // Convertir la medianoche local de vuelta a UTC
  // Necesitamos encontrar qué hora UTC corresponde a las 00:00 locales del día siguiente
  return localMidnightToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth(), nextDay.getUTCDate());
}

/**
 * Convierte una fecha local (año, mes, día) a UTC asumiendo medianoche en Europe/Madrid
 */
function localMidnightToUtc(year: number, month: number, day: number): Date {
  // Europa/Madrid es UTC+1 (CET) o UTC+2 (CEST)
  // Crear una fecha tentativa y ajustar
  const tentative = new Date(Date.UTC(year, month, day, 0, 0, 0));
  
  // Verificar qué offset tiene España en esta fecha
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Probar con UTC-1 (CET: medianoche local = 23:00 UTC del día anterior)
  const cetMidnight = new Date(Date.UTC(year, month, day - 1, 23, 0, 0));
  const cetParts = formatter.formatToParts(cetMidnight);
  const cetDay = parseInt(cetParts.find(p => p.type === 'day')?.value || '0');
  const cetHour = parseInt(cetParts.find(p => p.type === 'hour')?.value || '0');
  
  if (cetDay === day && cetHour === 0) return cetMidnight;
  
  // Probar con UTC-2 (CEST: medianoche local = 22:00 UTC del día anterior)
  const cestMidnight = new Date(Date.UTC(year, month, day - 1, 22, 0, 0));
  const cestParts = formatter.formatToParts(cestMidnight);
  const cestDay = parseInt(cestParts.find(p => p.type === 'day')?.value || '0');
  const cestHour = parseInt(cestParts.find(p => p.type === 'hour')?.value || '0');
  
  if (cestDay === day && cestHour === 0) return cestMidnight;
  
  // Fallback: asumir CET (UTC+1)
  return cetMidnight;
}

// ====================================
// Fingerprint
// ====================================

function computeFingerprint(
  sourceType: string,
  driverIdentifier: string | null,
  vehicleIdentifier: string | null,
  activityType: string,
  startUtc: Date,
  endUtc: Date
): string {
  const data = [
    sourceType,
    driverIdentifier || '',
    vehicleIdentifier || '',
    activityType,
    startUtc.toISOString(),
    endUtc.toISOString(),
  ].join('|');
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

// ====================================
// Pipeline principal
// ====================================

export function normalizeRawEvents(
  rawEvents: BinaryRawEvent[],
  sourceType: string,
  existingFingerprints?: Set<string>
): NormalizationResult {
  const warnings: string[] = [];
  
  if (rawEvents.length === 0) {
    return { normalizedEvents: [], dailySummaries: [], incidents: [], warnings: ['No hay eventos brutos para normalizar.'] };
  }

  // 1. Convertir a normalized events con timezone
  let events: NormalizedEventData[] = rawEvents.map((raw, index) => {
    const startLocal = utcToMadrid(raw.rawStartAt);
    const endLocal = utcToMadrid(raw.rawEndAt);
    const opDay = getOperationalDayLocal(raw.rawStartAt);
    const fingerprint = computeFingerprint(
      sourceType,
      raw.rawDriverIdentifier,
      raw.rawVehicleIdentifier,
      raw.rawActivityType,
      raw.rawStartAt,
      raw.rawEndAt
    );
    
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (raw.extractionStatus === 'SUSPECT') confidence = 'low';
    // 'spec' solo garantiza parseo correcto, no completitud del día
    // La promoción a 'high' ocurre en consolidación con cobertura ≥80%
    // if (raw.extractionMethod === 'spec') confidence = 'high';
    
    return {
      sourceType,
      startAtUtc: raw.rawStartAt,
      endAtUtc: raw.rawEndAt,
      startAtLocal: startLocal,
      endAtLocal: endLocal,
      operationalDayLocal: opDay,
      normalizedActivityType: raw.rawActivityType as ActivityType,
      durationMinutes: Math.round((raw.rawEndAt.getTime() - raw.rawStartAt.getTime()) / 60000),
      extractionMethod: raw.extractionMethod,
      confidenceLevel: confidence,
      matchingStatus: 'unmatched' as const,
      consolidationStatus: 'provisional' as const,
      consolidationReason: 'Initial normalization, pending matching',
      isSplitCrossMidnight: false,
      fingerprint,
      parentRawEventIndex: index,
      rawDriverIdentifier: raw.rawDriverIdentifier,
      rawVehicleIdentifier: raw.rawVehicleIdentifier,
    };
  });

  // 2. Deduplicar por fingerprint
  if (existingFingerprints && existingFingerprints.size > 0) {
    const before = events.length;
    events = events.filter(e => !existingFingerprints.has(e.fingerprint));
    const removed = before - events.length;
    if (removed > 0) {
      warnings.push(`Se eliminaron ${removed} eventos duplicados (fingerprint ya existente).`);
    }
  }

  // 3. Ordenar por inicio UTC
  events.sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());

  // 4. Fusionar eventos solapados del mismo tipo
  events = mergeOverlapping(events);

  // 5. Split por medianoche LOCAL
  events = splitByLocalMidnight(events);

  // 6. Rellenar huecos > 5 min con REST (dentro del mismo día)
  events = fillGaps(events, sourceType);

  // 7. Validar límites (no más de 24h por día)
  const { validated, overflowDays } = validateDayLimits(events);
  events = validated;
  for (const day of overflowDays) {
    warnings.push(`Día ${day}: las actividades suman más de 24h. Confianza reducida.`);
  }

  // 8. Aplicar política de consolidación
  events = applyConsolidationPolicy(events);

  // 9. Recalcular duraciones
  events = events.map(e => ({
    ...e,
    durationMinutes: Math.round((e.endAtUtc.getTime() - e.startAtUtc.getTime()) / 60000),
  }));

  // 10. Calcular resúmenes diarios (solo operative + provisional con confidence >= medium)
  const dailySummaries = calculateDailySummaries(events);

  // 11. Detectar incidencias de regulación
  const incidents = checkRegulations(events, dailySummaries);

  return { normalizedEvents: events, dailySummaries, incidents, warnings };
}

// ====================================
// Merge overlapping
// ====================================

function mergeOverlapping(events: NormalizedEventData[]): NormalizedEventData[] {
  if (events.length <= 1) return events;
  const merged: NormalizedEventData[] = [{ ...events[0] }];
  
  for (let i = 1; i < events.length; i++) {
    const current = events[i];
    const prev = merged[merged.length - 1];
    
    if (
      prev.normalizedActivityType === current.normalizedActivityType &&
      current.startAtUtc.getTime() <= prev.endAtUtc.getTime() + 120000
    ) {
      if (current.endAtUtc.getTime() > prev.endAtUtc.getTime()) {
        prev.endAtUtc = new Date(current.endAtUtc);
        prev.endAtLocal = utcToMadrid(prev.endAtUtc);
      }
      prev.durationMinutes = Math.round((prev.endAtUtc.getTime() - prev.startAtUtc.getTime()) / 60000);
      if (current.confidenceLevel === 'high') prev.confidenceLevel = 'high';
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

// ====================================
// Split por medianoche LOCAL
// ====================================

function splitByLocalMidnight(events: NormalizedEventData[]): NormalizedEventData[] {
  const result: NormalizedEventData[] = [];
  
  for (const event of events) {
    const startDayLocal = event.operationalDayLocal.toISOString().substring(0, 10);
    const endLocal = utcToMadrid(event.endAtUtc);
    const endDayLocal = `${endLocal.getUTCFullYear()}-${String(endLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(endLocal.getUTCDate()).padStart(2, '0')}`;
    
    if (startDayLocal === endDayLocal) {
      result.push(event);
    } else {
      // Split at local midnight boundaries
      let currentStartUtc = new Date(event.startAtUtc);
      let safetyCounter = 0;
      
      while (safetyCounter < 10) {
        safetyCounter++;
        const midnightUtc = nextLocalMidnight(currentStartUtc);
        
        if (midnightUtc.getTime() >= event.endAtUtc.getTime()) {
          // Last segment
          const startLocal = utcToMadrid(currentStartUtc);
          result.push({
            ...event,
            startAtUtc: currentStartUtc,
            endAtUtc: new Date(event.endAtUtc),
            startAtLocal: startLocal,
            endAtLocal: utcToMadrid(event.endAtUtc),
            operationalDayLocal: getOperationalDayLocal(currentStartUtc),
            durationMinutes: Math.round((event.endAtUtc.getTime() - currentStartUtc.getTime()) / 60000),
            isSplitCrossMidnight: true,
            extractionMethod: 'derived',
            consolidationReason: 'Split at local midnight (Europe/Madrid)',
          });
          break;
        } else {
          // Segment ending at local midnight
          const startLocal = utcToMadrid(currentStartUtc);
          result.push({
            ...event,
            startAtUtc: currentStartUtc,
            endAtUtc: midnightUtc,
            startAtLocal: startLocal,
            endAtLocal: utcToMadrid(midnightUtc),
            operationalDayLocal: getOperationalDayLocal(currentStartUtc),
            durationMinutes: Math.round((midnightUtc.getTime() - currentStartUtc.getTime()) / 60000),
            isSplitCrossMidnight: true,
            extractionMethod: 'derived',
            consolidationReason: 'Split at local midnight (Europe/Madrid)',
            fingerprint: event.fingerprint + '_split' + safetyCounter,
          });
          currentStartUtc = midnightUtc;
        }
      }
    }
  }
  return result;
}

// ====================================
// Fill gaps
// ====================================

function fillGaps(events: NormalizedEventData[], sourceType: string): NormalizedEventData[] {
  if (events.length <= 1) return events;
  const result: NormalizedEventData[] = [events[0]];
  
  for (let i = 1; i < events.length; i++) {
    const prev = result[result.length - 1];
    const current = events[i];
    
    // Solo rellenar huecos dentro del mismo día operativo
    const sameDay = prev.operationalDayLocal.getTime() === current.operationalDayLocal.getTime();
    const gapMs = current.startAtUtc.getTime() - prev.endAtUtc.getTime();
    const gapMinutes = gapMs / 60000;
    
    if (sameDay && gapMinutes > 5) {
      const gapStart = new Date(prev.endAtUtc);
      const gapEnd = new Date(current.startAtUtc);
      const fp = computeFingerprint(sourceType, null, null, 'REST', gapStart, gapEnd);
      
      result.push({
        sourceType,
        startAtUtc: gapStart,
        endAtUtc: gapEnd,
        startAtLocal: utcToMadrid(gapStart),
        endAtLocal: utcToMadrid(gapEnd),
        operationalDayLocal: prev.operationalDayLocal,
        normalizedActivityType: 'REST',
        durationMinutes: Math.round(gapMinutes),
        extractionMethod: 'derived',
        confidenceLevel: 'low',
        matchingStatus: 'unmatched',
        consolidationStatus: 'provisional',
        consolidationReason: 'Gap fill (>5min gap inferred as REST)',
        isSplitCrossMidnight: false,
        fingerprint: fp,
        parentRawEventIndex: -1,
        rawDriverIdentifier: prev.rawDriverIdentifier,
        rawVehicleIdentifier: prev.rawVehicleIdentifier,
      });
    }
    result.push(current);
  }
  return result;
}

// ====================================
// Validate day limits
// ====================================

function validateDayLimits(events: NormalizedEventData[]): {
  validated: NormalizedEventData[];
  overflowDays: string[];
} {
  const byDay = new Map<string, NormalizedEventData[]>();
  for (const e of events) {
    const day = e.operationalDayLocal.toISOString().substring(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  const overflowDays: string[] = [];
  const validated: NormalizedEventData[] = [];

  for (const [day, dayEvents] of byDay) {
    const totalMinutes = dayEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
    if (totalMinutes > 1440 * 1.1) {
      overflowDays.push(day);
      for (const e of dayEvents) {
        validated.push({ ...e, confidenceLevel: 'low' });
      }
    } else {
      validated.push(...dayEvents);
    }
  }
  return { validated, overflowDays };
}

// ====================================
// Aplicar política de consolidación
// ====================================

function applyConsolidationPolicy(events: NormalizedEventData[]): NormalizedEventData[] {
  return events.map(e => {
    let status: 'operative' | 'provisional' | 'excluded' = 'provisional';
    let reason = e.consolidationReason;
    
    // Regla 1: confidence >= medium + no conflicto → provisional (se promoverá a operative después de matching)
    if (e.confidenceLevel === 'low') {
      status = 'provisional';
      reason = 'Low confidence, pending additional data';
    } else {
      status = 'provisional';
      reason = 'Awaiting matching to determine operative status';
    }
    
    // La promoción a 'operative' ocurre en el servicio después del matching.
    // Aquí solo establecemos el estado inicial.
    
    return { ...e, consolidationStatus: status, consolidationReason: reason };
  });
}

// ====================================
// Daily summaries
// ====================================

function calculateDailySummaries(events: NormalizedEventData[]): DailySummary[] {
  const byDay = new Map<string, NormalizedEventData[]>();
  for (const e of events) {
    const day = e.operationalDayLocal.toISOString().substring(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(e);
  }

  const summaries: DailySummary[] = [];

  for (const [date, dayEvents] of byDay) {
    const includedEvents = dayEvents.filter(e => e.consolidationStatus !== 'excluded');

    const driving = sumByType(includedEvents, 'DRIVING');
    const otherWork = sumByType(includedEvents, 'OTHER_WORK');
    const availability = sumByType(includedEvents, 'AVAILABILITY');
    const rest = sumByType(includedEvents, 'REST');
    const breakMins = sumByType(includedEvents, 'BREAK');

    // Desglose de cobertura
    const ownSourceEvents = includedEvents.filter(e => !e.isSplitCrossMidnight || e.extractionMethod !== 'derived');
    const inheritedSplits = includedEvents.filter(e => e.isSplitCrossMidnight && e.extractionMethod === 'derived');
    const gapFills = includedEvents.filter(e => e.consolidationReason?.includes('Gap fill'));

    const ownSourceMinutes = ownSourceEvents
      .filter(e => !gapFills.includes(e))
      .reduce((s, e) => s + e.durationMinutes, 0);
    const inheritedSplitMinutes = inheritedSplits.reduce((s, e) => s + e.durationMinutes, 0);

    // rawEventsCount: count non-split, non-gap-fill events with parentRawEventIndex >= 0
    const rawEventsCount = ownSourceEvents
      .filter(e => e.parentRawEventIndex >= 0 && !gapFills.includes(e))
      .length;

    // Coverage ratios (DESCRIPTIVOS, sin gapFill)
    const observedMinutes = ownSourceMinutes + inheritedSplitMinutes;
    const calendarCoverageRatio = Math.min(1, observedMinutes / 1440);
    const totalCoverageRatio = calendarCoverageRatio; // Sin gapFill

    const totalCovered = driving + otherWork + availability + rest + breakMins;
    const coveragePercent = Math.min(100, Math.round((totalCovered / 1440) * 100));
    const gapMinutes = Math.max(0, 1440 - totalCovered);

    // Consistency (visual)
    let consistency: DailySummary['consistencyStatus'] = 'ok';
    if (dayEvents.some(e => e.consolidationStatus === 'excluded')) {
      consistency = 'conflict';
    } else if (totalCovered > 1440 * 1.1) {
      consistency = 'error';
    } else if (coveragePercent < 50) {
      consistency = 'warning';
    }

    // Source origin
    const sources = new Set(dayEvents.map(e => e.sourceType));
    const sourceDataOrigin = sources.size > 1 ? 'MIXED' : sources.values().next().value || null;

    // Average confidence
    const confidences = includedEvents.map(e => e.confidenceLevel);
    const avgConf = confidences.includes('low') ? 'low' : confidences.includes('medium') ? 'medium' : 'high';

    // confidenceWeightedScore: Σ(min × weight) / Σ(min)
    const confWeights: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.2 };
    const totalMinutesForScore = includedEvents.reduce((s, e) => s + e.durationMinutes, 0);
    const weightedSum = includedEvents.reduce((s, e) => {
      return s + e.durationMinutes * (confWeights[e.confidenceLevel] || 0.2);
    }, 0);
    const confidenceWeightedScore = totalMinutesForScore > 0 ? weightedSum / totalMinutesForScore : 0;

    // dayConsolidationStatus
    let dayConsolidationStatus: DailySummary['dayConsolidationStatus'] = 'VALID';
    if (rawEventsCount === 0) {
      dayConsolidationStatus = 'BLOCKED_NO_SOURCE';
    } else if (confidenceWeightedScore < 0.3) {
      dayConsolidationStatus = 'BLOCKED_LOW_CONFIDENCE';
    }
    // BLOCKED_CONFLICT: detected later in service layer (SOURCE_OVERLAP, DUPLICATE_IMPORT_CONFLICT, VEHICLE_MISMATCH, TIMESTAMP_ANOMALY)

    summaries.push({
      date,
      totalDrivingMinutes: driving,
      totalOtherWorkMinutes: otherWork,
      totalAvailabilityMinutes: availability,
      totalRestMinutes: rest,
      totalBreakMinutes: breakMins,
      gapMinutes,
      coveragePercent,
      consistencyStatus: consistency,
      sourceDataOrigin,
      averageConfidence: avgConf,
      importedFromCount: 1,
      ownSourceMinutes,
      inheritedSplitMinutes,
      rawEventsCount,
      calendarCoverageRatio,
      totalCoverageRatio,
      dayConsolidationStatus,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

function sumByType(events: NormalizedEventData[], type: ActivityType): number {
  return events.filter(e => e.normalizedActivityType === type).reduce((sum, e) => sum + e.durationMinutes, 0);
}

// ====================================
// Regulation checks
// ====================================

function checkRegulations(events: NormalizedEventData[], summaries: DailySummary[]): RegulationIncident[] {
  const incidents: RegulationIncident[] = [];
  
  // 1. Conducción continua > 4h30min sin pausa >= 45min
  const sorted = [...events]
    .filter(e => e.consolidationStatus !== 'excluded')
    .sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());
  
  let continuousDriving = 0;
  let drivingStart: Date | null = null;
  
  for (const e of sorted) {
    if (e.normalizedActivityType === 'DRIVING') {
      if (!drivingStart) drivingStart = e.startAtUtc;
      continuousDriving += e.durationMinutes;
      
      if (continuousDriving > 270) {
        incidents.push({
          type: 'DRIVING_TIME_EXCEEDED',
          severity: 'HIGH',
          title: `Conducción continua > 4h30min`,
          description: `${Math.round(continuousDriving)} min de conducción continua sin pausa reglamentaria (≥45min). Inicio: ${drivingStart!.toISOString()}.`,
          date: e.operationalDayLocal.toISOString().substring(0, 10),
          durationMinutes: continuousDriving,
        });
        continuousDriving = 0;
        drivingStart = null;
      }
    } else if (e.normalizedActivityType === 'REST' || e.normalizedActivityType === 'BREAK') {
      if (e.durationMinutes >= 45) {
        continuousDriving = 0;
        drivingStart = null;
      }
    }
  }

  // 2. Conducción diaria > 9h
  for (const s of summaries) {
    if (s.totalDrivingMinutes > 540) {
      const severity = s.totalDrivingMinutes > 600 ? 'HIGH' : 'MEDIUM';
      incidents.push({
        type: 'DAILY_DRIVING_EXCEEDED',
        severity: severity as 'HIGH' | 'MEDIUM',
        title: `Jornada conducción > ${s.totalDrivingMinutes > 600 ? '10h' : '9h'} el ${s.date}`,
        description: `${Math.round(s.totalDrivingMinutes / 60 * 10) / 10}h de conducción el ${s.date}. Máx general: 9h (10h excepcional 2x/semana).`,
        date: s.date,
        durationMinutes: s.totalDrivingMinutes,
      });
    }
  }

  // 3. Descanso diario insuficiente < 9h
  for (const s of summaries) {
    const totalRest = s.totalRestMinutes + s.totalBreakMinutes;
    if (totalRest < 540 && s.coveragePercent >= 80) {
      incidents.push({
        type: 'INSUFFICIENT_REST',
        severity: totalRest < 480 ? 'HIGH' : 'MEDIUM',
        title: `Descanso insuficiente el ${s.date}`,
        description: `Solo ${Math.round(totalRest / 60 * 10) / 10}h de descanso el ${s.date}. Mínimo: 11h (reducido: 9h).`,
        date: s.date,
        durationMinutes: totalRest,
      });
    }
  }

  return incidents;
}

// ====================================
// Legacy compatibility: normalizeActivities (old interface)
// ====================================

export function normalizeActivities(
  rawActivities: any[],
  existingActivities?: { startTime: Date; endTime: Date; activityType: string }[]
): {
  activities: any[];
  dailySummaries: DailySummary[];
  incidents: RegulationIncident[];
  warnings: string[];
} {
  // Convertir old format a BinaryRawEvent format
  const fakeRawEvents: BinaryRawEvent[] = rawActivities.map(a => ({
    rawStartAt: new Date(a.startTime),
    rawEndAt: new Date(a.endTime),
    rawActivityType: a.activityType,
    rawDriverIdentifier: null,
    rawVehicleIdentifier: null,
    rawPayload: { slot: 0, cardInserted: false, byteOffset: 0, headerOffset: 0, dayTimestamp: 0 },
    extractionMethod: 'heuristic' as const,
    extractionNotes: 'Legacy compatibility conversion',
    extractionStatus: 'OK' as const,
  }));

  const existingFps = new Set<string>();
  if (existingActivities) {
    for (const ea of existingActivities) {
      existingFps.add(computeFingerprint('UNKNOWN', null, null, ea.activityType, new Date(ea.startTime), new Date(ea.endTime)));
    }
  }

  const result = normalizeRawEvents(fakeRawEvents, 'UNKNOWN', existingFps);
  
  // Convert back to old format
  return {
    activities: result.normalizedEvents.map(e => ({
      activityType: e.normalizedActivityType,
      startTime: e.startAtUtc,
      endTime: e.endAtUtc,
      durationMinutes: e.durationMinutes,
      confidenceLevel: e.confidenceLevel,
      countryStart: null,
      countryEnd: null,
      rawPayload: null,
    })),
    dailySummaries: result.dailySummaries,
    incidents: result.incidents,
    warnings: result.warnings,
  };
}
