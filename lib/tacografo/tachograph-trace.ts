/**
 * TachographTrace v1 — Tipos y utilidades para el modo trace/debug del parser
 * 
 * Proporciona visibilidad completa sobre:
 * - Candidatos de timestamp encontrados en el binario
 * - Bloques de actividad detectados (aceptados/rechazados)
 * - VRNs detectados con contexto (file_scan vs vehicle_used_record)
 * - Vista resumida por día
 */

import type { BinaryRawEvent } from './tachograph-binary-parser';

// ====================================
// Status de candidatos
// ====================================

export type CandidateStatus =
  | 'FOUND'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'BLOCKED_CONFIDENCE'
  | 'BLOCKED_CONFLICT';

// ====================================
// Candidato de timestamp
// ====================================

export interface CandidateTimestamp {
  offset: number;
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isMidnightAligned: boolean;
  isPlausible: boolean;
  status: CandidateStatus;
  reason: string;
}

// ====================================
// Bloque de actividad candidato
// ====================================

export interface CandidateBlock {
  timestampOffset: number;
  headerOffset: number;
  dayDate: string; // YYYY-MM-DD UTC
  recordsCount: number;
  totalMinutes: number;
  status: CandidateStatus;
  reason: string;
  parsedRecords?: { activity: string; startMin: number }[];
}

// ====================================
// VRN detectado
// ====================================

export interface DetectedVRN {
  plate: string;
  offset: number;
  context: 'file_scan' | 'vehicle_used_record';
  associatedDates: string[] | null; // fechas del vehicle_used_record, null si es file_scan
}

// ====================================
// Resumen por día del trace
// ====================================

export interface TraceDaySummary {
  date: string;
  candidatesFound: number;
  candidatesAccepted: number;
  rejectedByReason: Record<string, number>;
  vrnsDetected: DetectedVRN[];
  rawEventsFinal: number;
  gapMinutes: number;
}

// ====================================
// Resultado completo del trace
// ====================================

export interface ParserTraceResult {
  fileName: string;
  fileSize: number;
  fileType: string;

  candidateTimestamps: CandidateTimestamp[];
  candidateBlocks: CandidateBlock[];
  detectedVRNs: DetectedVRN[];

  acceptedEvents: BinaryRawEvent[];
  rejectedCandidates: CandidateBlock[];

  // Vista resumida por día
  daySummaries: TraceDaySummary[];

  summary: {
    totalCandidatesFound: number;
    totalAccepted: number;
    totalRejected: number;
    totalBlockedConfidence: number;
    totalBlockedConflict: number;
    uniqueDaysAccepted: string[];
    uniqueDaysRejected: string[];
  };
}

// ====================================
// Opciones del trace
// ====================================

export interface TraceOptions {
  targetDate?: string;     // YYYY-MM-DD — día objetivo
  windowDays?: number;     // ±N días alrededor del target (default: 1)
  mode?: 'summary' | 'detailed';
  maxResults?: number;     // máx candidatos en modo detailed (default: 500)
}

// ====================================
// Generador de vista resumida por día
// ====================================

export function buildDaySummaries(
  candidateBlocks: CandidateBlock[],
  acceptedEvents: BinaryRawEvent[],
  detectedVRNs: DetectedVRN[],
): TraceDaySummary[] {
  const dayMap = new Map<string, TraceDaySummary>();

  const getOrCreate = (date: string): TraceDaySummary => {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        date,
        candidatesFound: 0,
        candidatesAccepted: 0,
        rejectedByReason: {},
        vrnsDetected: [],
        rawEventsFinal: 0,
        gapMinutes: 0,
      });
    }
    return dayMap.get(date)!;
  };

  // Contar candidatos por día
  for (const block of candidateBlocks) {
    const ds = getOrCreate(block.dayDate);
    ds.candidatesFound++;
    if (block.status === 'ACCEPTED') {
      ds.candidatesAccepted++;
    } else if (block.status === 'REJECTED' || block.status === 'BLOCKED_CONFIDENCE' || block.status === 'BLOCKED_CONFLICT') {
      const reason = block.reason || block.status;
      ds.rejectedByReason[reason] = (ds.rejectedByReason[reason] || 0) + 1;
    }
  }

  // Contar raw events finales por día
  for (const evt of acceptedEvents) {
    const dayStr = evt.rawStartAt.toISOString().substring(0, 10);
    const ds = getOrCreate(dayStr);
    ds.rawEventsFinal++;
  }

  // Calcular gap por día
  for (const [, ds] of dayMap) {
    const dayEvents = acceptedEvents.filter(
      e => e.rawStartAt.toISOString().substring(0, 10) === ds.date
    );
    const coveredMinutes = dayEvents.reduce((sum, e) => {
      return sum + Math.round((e.rawEndAt.getTime() - e.rawStartAt.getTime()) / 60000);
    }, 0);
    ds.gapMinutes = Math.max(0, 1440 - coveredMinutes);
  }

  // VRNs por día
  for (const vrn of detectedVRNs) {
    if (vrn.associatedDates) {
      for (const d of vrn.associatedDates) {
        const ds = getOrCreate(d);
        ds.vrnsDetected.push(vrn);
      }
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Filtra un trace result a un rango de fechas
 */
export function filterTraceByDateRange(
  trace: ParserTraceResult,
  startDate: string,
  endDate: string,
): ParserTraceResult {
  const start = startDate;
  const end = endDate;

  return {
    ...trace,
    candidateTimestamps: trace.candidateTimestamps.filter(c => c.dateStr >= start && c.dateStr <= end),
    candidateBlocks: trace.candidateBlocks.filter(c => c.dayDate >= start && c.dayDate <= end),
    acceptedEvents: trace.acceptedEvents.filter(e => {
      const d = e.rawStartAt.toISOString().substring(0, 10);
      return d >= start && d <= end;
    }),
    rejectedCandidates: trace.rejectedCandidates.filter(c => c.dayDate >= start && c.dayDate <= end),
    daySummaries: trace.daySummaries.filter(d => d.date >= start && d.date <= end),
  };
}

/**
 * Genera un resumen compacto del trace (para modo summary)
 */
export function traceToSummaryMode(trace: ParserTraceResult): Omit<ParserTraceResult, 'candidateTimestamps' | 'acceptedEvents'> & { candidateTimestamps: never[]; acceptedEvents: never[] } {
  return {
    ...trace,
    candidateTimestamps: [] as never[],
    acceptedEvents: [] as never[],
    candidateBlocks: trace.candidateBlocks.map(b => ({ ...b, parsedRecords: undefined })),
  };
}
