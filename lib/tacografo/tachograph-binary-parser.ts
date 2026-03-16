/**
 * TachographBinaryParser v3 — Parser binario para archivos DDD/ESM/DTCO
 * 
 * Lee el contenido binario de archivos de tacógrafo digital
 * según la especificación EU Regulation 2016/799 (Annex 1C).
 * 
 * v3: Añade modo trace completo con candidatos aceptados/rechazados
 * y separación de VRN file-level vs event-level.
 */

import type {
  CandidateTimestamp,
  CandidateBlock,
  DetectedVRN,
  ParserTraceResult,
  TraceOptions,
} from './tachograph-trace';
import { buildDaySummaries } from './tachograph-trace';

// ====================================
// Constantes de actividad (2 bits)
// ====================================
const ACTIVITY_CODES: Record<number, string> = {
  0: 'REST',        // 00 = Break/Rest
  1: 'AVAILABILITY', // 01 = Availability
  2: 'OTHER_WORK',   // 10 = Other work
  3: 'DRIVING',      // 11 = Driving
};

// ====================================
// Interfaces exportadas
// ====================================

/** Evento bruto extraído del parser — 1 por cada cambio de actividad detectado */
export interface BinaryRawEvent {
  rawStartAt: Date;
  rawEndAt: Date;
  rawActivityType: string;
  rawDriverIdentifier: string | null;
  rawVehicleIdentifier: string | null;
  rawPayload: {
    slot: number;
    cardInserted: boolean;
    byteOffset: number;
    headerOffset: number;
    dayTimestamp: number;
  };
  extractionMethod: 'spec' | 'heuristic' | 'derived';
  extractionNotes: string;
  extractionStatus: 'OK' | 'SUSPECT' | 'ERROR';
}

/** Resultado completo del parser binario */
export interface BinaryParseResult {
  success: boolean;
  fileType: 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN';
  parserVersion: string;
  metadata: {
    driverName?: string;
    cardNumber?: string;
    cardExpiry?: Date;
    plateNumber?: string;
    vin?: string;
    dateFrom?: Date;
    dateTo?: Date;
    driverDni?: string;
    fileLevelVRNs?: DetectedVRN[];
    vehicleUsedRecords?: VehicleUsedRecord[];
    [key: string]: any;
  };
  rawEvents: BinaryRawEvent[];
  warnings: string[];
  errors: string[];
}

/** Resultado del parser con trace */
export interface BinaryParseWithTraceResult {
  result: BinaryParseResult;
  trace: ParserTraceResult;
}

// ====================================
// Utilidades de lectura binaria
// ====================================

function readUint8(buf: Buffer, offset: number): number {
  if (offset >= buf.length) return 0;
  return buf[offset];
}

function readUint16BE(buf: Buffer, offset: number): number {
  if (offset + 1 >= buf.length) return 0;
  return (buf[offset] << 8) | buf[offset + 1];
}

function readUint32BE(buf: Buffer, offset: number): number {
  if (offset + 3 >= buf.length) return 0;
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readAscii(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) length = buf.length - offset;
  if (length <= 0) return '';
  const bytes = buf.subarray(offset, offset + length);
  return Array.from(bytes)
    .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '')
    .join('')
    .trim();
}

function readTimestamp(buf: Buffer, offset: number): Date | null {
  if (offset + 3 >= buf.length) return null;
  const ts = readUint32BE(buf, offset);
  if (ts === 0 || ts === 0xffffffff) return null;
  const date = new Date(ts * 1000);
  if (date.getFullYear() >= 2000 && date.getFullYear() <= 2040) {
    return date;
  }
  return null;
}

// ====================================
// Interfaces internas
// ====================================

interface ParsedRecord {
  activityType: string;
  startMinutes: number;
  slot: number;
  cardInserted: boolean;
}

interface DriverIdentification {
  surname: string | null;
  firstName: string | null;
  cardNumber: string | null;
  cardExpiry: Date | null;
  issuingNation: string | null;
}

interface TimestampPosition {
  offset: number;
  date: Date;
}

// ====================================
// Parser principal v2
// ====================================

// ====================================
// Core parse logic (shared by normal + trace)
// ====================================

function coreParseLogic(buffer: Buffer, fileName: string, enableTrace: boolean): {
  result: BinaryParseResult;
  traceData: {
    candidateTimestamps: CandidateTimestamp[];
    candidateBlocks: CandidateBlock[];
    detectedVRNs: DetectedVRN[];
    rejectedCandidates: CandidateBlock[];
  } | null;
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rawEvents: BinaryRawEvent[] = [];
  const metadata: BinaryParseResult['metadata'] = {};
  let fileType: 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN' = 'UNKNOWN';

  // Trace collectors
  const traceCandidateTs: CandidateTimestamp[] = [];
  const traceCandidateBlocks: CandidateBlock[] = [];
  const traceDetectedVRNs: DetectedVRN[] = [];
  const traceRejected: CandidateBlock[] = [];

  // Determinar tipo
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const baseName = fileName.split(/[\\/]/).pop()?.toUpperCase() || '';
  if (['esm', 'v1b'].includes(ext)) fileType = 'VEHICLE_UNIT';
  else if (['c1b', 'tgd'].includes(ext)) fileType = 'DRIVER_CARD';
  else if (ext === 'ddd' || ext === 'dtco') {
    if (baseName.startsWith('C_') || baseName.startsWith('C1_') || baseName.startsWith('C2_')) fileType = 'DRIVER_CARD';
    else if (baseName.startsWith('S_') || baseName.startsWith('M_')) fileType = 'VEHICLE_UNIT';
  }

  if (buffer.length < 10) {
    errors.push('Archivo demasiado pequeño');
    return {
      result: { success: true, fileType, parserVersion: 'binary-v3', metadata, rawEvents, warnings, errors },
      traceData: enableTrace ? { candidateTimestamps: [], candidateBlocks: [], detectedVRNs: [], rejectedCandidates: [] } : null,
    };
  }

  const cardInfo = extractCardInfoFromFileName(fileName);
  const rawDriverId = cardInfo.cardNumber || null;
  const rawVehicleId = extractPlateFromFileName(fileName);
  if (cardInfo.cardNumber) metadata.cardNumber = cardInfo.cardNumber;
  if (cardInfo.dni) metadata.driverDni = cardInfo.dni;

  try {
    // 1. VRN scan (file-level, todos los tipos)
    const vrnScan = findVRN(buffer);
    if (vrnScan) {
      metadata.plateNumber = vrnScan;
      traceDetectedVRNs.push({ plate: vrnScan, offset: -1, context: 'file_scan', associatedDates: null });
    }

    // 1b. Vehicle used records (DRIVER_CARD)
    const vehicleRecords = findVehicleUsedRecords(buffer);
    metadata.vehicleUsedRecords = vehicleRecords;
    for (const vr of vehicleRecords) {
      const dates: string[] = [];
      if (vr.startDate) dates.push(vr.startDate.toISOString().substring(0, 10));
      if (vr.endDate) dates.push(vr.endDate.toISOString().substring(0, 10));
      traceDetectedVRNs.push({
        plate: vr.vrn,
        offset: -1,
        context: 'vehicle_used_record',
        associatedDates: dates.length > 0 ? dates : null,
      });
    }
    
    // fileLevelVRNs in metadata
    metadata.fileLevelVRNs = traceDetectedVRNs;

    if (!metadata.plateNumber && vehicleRecords.length > 0 && vehicleRecords[0].vrn) {
      metadata.plateNumber = vehicleRecords[0].vrn;
      warnings.push('La matrícula se extrajo de vehicle_used_records del binario.');
    }

    // 2. VIN
    const vin = findVIN(buffer);
    if (vin) metadata.vin = vin;

    // 3. Driver data
    const driver = findDriverData(buffer);
    if (driver.surname || driver.firstName) {
      metadata.driverName = [driver.surname, driver.firstName].filter(Boolean).join(' ').trim();
      if (fileType === 'UNKNOWN') fileType = 'DRIVER_CARD';
    }
    if (driver.cardExpiry) metadata.cardExpiry = driver.cardExpiry;

    // 4. Extract raw events with optional trace
    const fileDate = extractDateFromFileName(fileName);
    
    // v3: rawVehicleIdentifier se asigna por vehicle_used_record, NO globalmente
    const events = extractRawEventsWithTrace(
      buffer, fileType, fileDate, rawDriverId, vehicleRecords,
      metadata.plateNumber || rawVehicleId || null,
      enableTrace ? traceCandidateTs : null,
      enableTrace ? traceCandidateBlocks : null,
      enableTrace ? traceRejected : null,
    );
    rawEvents.push(...events);

    if (rawEvents.length > 0) {
      const sorted = [...rawEvents].sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
      metadata.dateFrom = sorted[0].rawStartAt;
      metadata.dateTo = sorted[sorted.length - 1].rawEndAt;
    }

    if (rawEvents.length === 0) {
      const dates = findAllTimestamps(buffer, fileDate);
      if (dates.length >= 2) {
        metadata.dateFrom = dates[0];
        metadata.dateTo = dates[dates.length - 1];
        warnings.push(`No se extrajeron actividades. ${dates.length} timestamps detectados.`);
      }
    }

    if (!metadata.plateNumber && rawVehicleId) {
      metadata.plateNumber = rawVehicleId;
      warnings.push('Matrícula extraída del nombre del archivo.');
    }
    if (!metadata.dateFrom && fileDate) {
      metadata.dateFrom = fileDate;
      metadata.dateTo = fileDate;
    }

    // Determine file type if unknown
    if (fileType === 'UNKNOWN') {
      if (metadata.cardNumber) fileType = 'DRIVER_CARD';
      else if (metadata.vin || metadata.plateNumber) fileType = 'VEHICLE_UNIT';
    }
    if (fileType === 'VEHICLE_UNIT' && metadata.cardNumber && !metadata.vin) {
      fileType = 'DRIVER_CARD';
      warnings.push('Reclasificado como tarjeta de conductor.');
    }
    if (rawEvents.length === 0) warnings.push('No se extrajeron actividades detalladas del binario.');

  } catch (err: any) {
    errors.push(`Error: ${err.message}`);
  }

  return {
    result: { success: true, fileType, parserVersion: 'binary-v3', metadata, rawEvents, warnings, errors },
    traceData: enableTrace ? {
      candidateTimestamps: traceCandidateTs,
      candidateBlocks: traceCandidateBlocks,
      detectedVRNs: traceDetectedVRNs,
      rejectedCandidates: traceRejected,
    } : null,
  };
}

/**
 * Parser principal (sin trace, para uso normal).
 */
export function parseBinaryTachograph(buffer: Buffer, fileName: string): BinaryParseResult {
  return coreParseLogic(buffer, fileName, false).result;
}

/**
 * Parser con trace completo (para diagnóstico).
 */
export function parseBinaryTachographWithTrace(
  buffer: Buffer,
  fileName: string,
  options?: TraceOptions,
): BinaryParseWithTraceResult {
  const { result, traceData } = coreParseLogic(buffer, fileName, true);
  const td = traceData!;

  // Resumen
  const accepted = td.candidateBlocks.filter(b => b.status === 'ACCEPTED');
  const rejected = td.candidateBlocks.filter(b => b.status === 'REJECTED');
  const blockedConf = td.candidateBlocks.filter(b => b.status === 'BLOCKED_CONFIDENCE');
  const blockedConfl = td.candidateBlocks.filter(b => b.status === 'BLOCKED_CONFLICT');

  const uniqueDaysAccepted = [...new Set(accepted.map(b => b.dayDate))].sort();
  const uniqueDaysRejected = [...new Set(rejected.map(b => b.dayDate))].sort();

  const daySummaries = buildDaySummaries(td.candidateBlocks, result.rawEvents, td.detectedVRNs);

  let trace: ParserTraceResult = {
    fileName,
    fileSize: buffer.length,
    fileType: result.fileType,
    candidateTimestamps: td.candidateTimestamps,
    candidateBlocks: td.candidateBlocks,
    detectedVRNs: td.detectedVRNs,
    acceptedEvents: result.rawEvents,
    rejectedCandidates: td.rejectedCandidates,
    daySummaries,
    summary: {
      totalCandidatesFound: td.candidateBlocks.length,
      totalAccepted: accepted.length,
      totalRejected: rejected.length,
      totalBlockedConfidence: blockedConf.length,
      totalBlockedConflict: blockedConfl.length,
      uniqueDaysAccepted,
      uniqueDaysRejected,
    },
  };

  // Apply trace options filtering
  if (options?.targetDate) {
    const window = options.windowDays ?? 1;
    const target = new Date(options.targetDate + 'T00:00:00Z');
    const startD = new Date(target.getTime() - window * 86400000);
    const endD = new Date(target.getTime() + window * 86400000);
    const startStr = startD.toISOString().substring(0, 10);
    const endStr = endD.toISOString().substring(0, 10);

    const { filterTraceByDateRange } = require('./tachograph-trace');
    trace = filterTraceByDateRange(trace, startStr, endStr);
  }

  if (options?.maxResults && trace.candidateBlocks.length > options.maxResults) {
    trace.candidateBlocks = trace.candidateBlocks.slice(0, options.maxResults);
  }

  return { result, trace };
}

// ====================================
// Extracción de raw events con trace opcional
// ====================================

function extractRawEventsWithTrace(
  buf: Buffer,
  fileType: string,
  fileDate: Date | null,
  rawDriverId: string | null,
  vehicleUsedRecords: VehicleUsedRecord[],
  fallbackVehicleId: string | null,
  traceCandidateTs: CandidateTimestamp[] | null,
  traceCandidateBlocks: CandidateBlock[] | null,
  traceRejected: CandidateBlock[] | null,
): BinaryRawEvent[] {
  const referenceDate = fileDate || new Date();
  const maxYearsBack = 3;
  const minDate = new Date(referenceDate.getTime() - maxYearsBack * 365.25 * 24 * 60 * 60 * 1000);
  const maxDate = new Date(referenceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  const tsPositions = findTimestampPositions(buf, minDate, maxDate);

  const allEvents: BinaryRawEvent[] = [];
  const usedTimestampOffsets = new Set<number>();

  const plausibleMin = fileDate
    ? new Date(fileDate.getTime() - 2 * 365.25 * 24 * 60 * 60 * 1000)
    : minDate;
  const plausibleMax = fileDate
    ? new Date(fileDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    : maxDate;

  for (const { offset, date } of tsPositions) {
    if (usedTimestampOffsets.has(offset)) continue;

    const isMidnightAligned = (Math.floor(date.getTime() / 1000) % 86400) === 0;
    const dayStartDate = new Date(Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0
    ));
    const dayStr = dayStartDate.toISOString().substring(0, 10);
    const dayTimestamp = Math.floor(dayStartDate.getTime() / 1000);
    const isPlausible = date >= plausibleMin && date <= plausibleMax;

    // Record candidate timestamp in trace
    if (traceCandidateTs) {
      traceCandidateTs.push({
        offset, date, dateStr: dayStr,
        isMidnightAligned, isPlausible,
        status: 'FOUND', reason: 'Timestamp in valid range',
      });
    }

    // Try multiple header offsets for activity records
    const headerOffsets = [4, 10, 8, 6, 12];
    let bestRecords: ParsedRecord[] = [];
    let bestTotalMinutes = 0;
    let bestHeaderOffset = 4;

    for (const hOffset of headerOffsets) {
      const candidate = tryParseRecords(buf, offset + hOffset);
      if (candidate.length >= 2) {
        const candMinutes = estimateTotalMinutes(candidate);
        if (candidate.length > bestRecords.length ||
            (candidate.length === bestRecords.length && candMinutes > bestTotalMinutes)) {
          bestRecords = candidate;
          bestTotalMinutes = candMinutes;
          bestHeaderOffset = hOffset;
        }
      }
    }

    // Candidate block for trace
    const candidateBlock: CandidateBlock = {
      timestampOffset: offset,
      headerOffset: bestHeaderOffset,
      dayDate: dayStr,
      recordsCount: bestRecords.length,
      totalMinutes: bestTotalMinutes,
      status: 'FOUND',
      reason: '',
      parsedRecords: bestRecords.map(r => ({ activity: r.activityType, startMin: r.startMinutes })),
    };

    // Decision: accept or reject
    if (bestRecords.length < 2) {
      candidateBlock.status = 'REJECTED';
      candidateBlock.reason = `Insufficient records (${bestRecords.length} < 2)`;
      if (traceCandidateBlocks) traceCandidateBlocks.push(candidateBlock);
      if (traceRejected) traceRejected.push(candidateBlock);
      // Update timestamp status
      if (traceCandidateTs && traceCandidateTs.length > 0) {
        const last = traceCandidateTs[traceCandidateTs.length - 1];
        if (last.offset === offset) { last.status = 'REJECTED'; last.reason = candidateBlock.reason; }
      }
      continue;
    }
    if (bestTotalMinutes < 1) {
      candidateBlock.status = 'REJECTED';
      candidateBlock.reason = `Total minutes too low (${bestTotalMinutes} < 1)`;
      if (traceCandidateBlocks) traceCandidateBlocks.push(candidateBlock);
      if (traceRejected) traceRejected.push(candidateBlock);
      if (traceCandidateTs && traceCandidateTs.length > 0) {
        const last = traceCandidateTs[traceCandidateTs.length - 1];
        if (last.offset === offset) { last.status = 'REJECTED'; last.reason = candidateBlock.reason; }
      }
      continue;
    }

    // ACCEPTED
    candidateBlock.status = 'ACCEPTED';
    candidateBlock.reason = `${bestRecords.length} records, ${bestTotalMinutes} minutes, header+${bestHeaderOffset}`;
    if (!isPlausible) {
      candidateBlock.status = 'BLOCKED_CONFIDENCE';
      candidateBlock.reason += ` | Out of plausible range`;
    }
    if (traceCandidateBlocks) traceCandidateBlocks.push(candidateBlock);

    usedTimestampOffsets.add(offset);

    // v3: resolve rawVehicleIdentifier per-day from vehicle_used_records
    let eventVehicleId: string | null = null;
    if (vehicleUsedRecords.length > 0) {
      for (const vr of vehicleUsedRecords) {
        const vrStart = vr.startDate ? vr.startDate.toISOString().substring(0, 10) : null;
        const vrEnd = vr.endDate ? vr.endDate.toISOString().substring(0, 10) : null;
        if (vrStart && vrEnd && dayStr >= vrStart && dayStr <= vrEnd) {
          eventVehicleId = vr.vrn;
          break;
        }
        if (vrStart && !vrEnd && dayStr === vrStart) {
          eventVehicleId = vr.vrn;
          break;
        }
      }
    }
    // Fallback: only if no vehicle_used_record data at all
    if (!eventVehicleId && vehicleUsedRecords.length === 0) {
      eventVehicleId = fallbackVehicleId;
    }

    // Update timestamp status
    if (traceCandidateTs && traceCandidateTs.length > 0) {
      const last = traceCandidateTs[traceCandidateTs.length - 1];
      if (last.offset === offset) { last.status = candidateBlock.status; last.reason = candidateBlock.reason; }
    }

    // Convert records to raw events
    for (let i = 0; i < bestRecords.length; i++) {
      const rec = bestRecords[i];
      const startTime = new Date(dayStartDate.getTime() + rec.startMinutes * 60000);
      let endMinutes = (i + 1 < bestRecords.length) ? bestRecords[i + 1].startMinutes : 1440;
      const endTime = new Date(dayStartDate.getTime() + endMinutes * 60000);
      if (endMinutes - rec.startMinutes < 1) continue;

      const isLastRecord = i === bestRecords.length - 1;
      const event: BinaryRawEvent = {
        rawStartAt: startTime,
        rawEndAt: endTime,
        rawActivityType: rec.activityType,
        rawDriverIdentifier: rawDriverId,
        rawVehicleIdentifier: eventVehicleId,
        rawPayload: {
          slot: rec.slot,
          cardInserted: rec.cardInserted,
          byteOffset: offset + bestHeaderOffset + (i * 2),
          headerOffset: bestHeaderOffset,
          dayTimestamp,
        },
        extractionMethod: 'heuristic',
        extractionNotes: `ts@${offset}, hdr+${bestHeaderOffset}, rec ${i}/${bestRecords.length}`,
        extractionStatus: 'OK',
      };

      if (!isPlausible) {
        event.extractionStatus = 'SUSPECT';
        event.extractionNotes += ` | Out of plausible range`;
      }
      if (isLastRecord && endMinutes === 1440) {
        event.extractionNotes += ' | End derived (day boundary)';
      }
      allEvents.push(event);
    }
  }

  return allEvents;
}

// ====================================
// Parseo de activity change records (sin consolidar)
// ====================================

function tryParseRecords(buf: Buffer, offset: number): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  let prevMinutes = -1;
  let validCount = 0;
  let invalidCount = 0;
  let consecutiveInvalid = 0;
  
  for (let j = 0; j < 200; j++) {
    const pos = offset + (j * 2);
    if (pos + 1 >= buf.length) break;
    
    const record = readUint16BE(buf, pos);
    
    if (record === 0 || record === 0xffff) {
      consecutiveInvalid++;
      if (validCount > 0 && consecutiveInvalid >= 2) break;
      continue;
    }
    consecutiveInvalid = 0;
    
    const slot = (record >> 15) & 1;
    const cardInserted = ((record >> 13) & 1) === 1;
    const activityCode = (record >> 11) & 0x03;
    const minutes = record & 0x07ff;
    
    if (minutes > 1440) {
      invalidCount++;
      consecutiveInvalid++;
      if (consecutiveInvalid >= 3) break;
      continue;
    }
    
    if (prevMinutes >= 0 && minutes < prevMinutes) {
      invalidCount++;
      consecutiveInvalid++;
      if (consecutiveInvalid >= 3) break;
      continue;
    }
    
    validCount++;
    
    records.push({
      activityType: ACTIVITY_CODES[activityCode] || 'UNKNOWN',
      startMinutes: minutes,
      slot,
      cardInserted,
    });
    
    prevMinutes = minutes;
  }
  
  if (validCount >= 2 && validCount > invalidCount) {
    return records;
  }
  return [];
}

function estimateTotalMinutes(records: ParsedRecord[]): number {
  if (records.length < 2) return 0;
  return records[records.length - 1].startMinutes - records[0].startMinutes;
}

// ====================================
// Búsqueda de VRN (matrícula)
// ====================================

function findVRN(buf: Buffer): string | null {
  const spanishPlateNew = /(\d{4}[A-Z]{3})/;
  const spanishPlateOld = /([A-Z]{1,2}\d{4}[A-Z]{2,3})/;
  
  for (let i = 0; i < buf.length - 7; i++) {
    const chunk = readAscii(buf, i, 13);
    if (chunk.length >= 5) {
      const matchNew = chunk.match(spanishPlateNew);
      if (matchNew) return matchNew[1];
      
      const matchOld = chunk.match(spanishPlateOld);
      if (matchOld && matchOld[1].length >= 7) return matchOld[1];
    }
  }

  const text = readAscii(buf, 0, Math.min(buf.length, 50000));
  const matchAll = text.match(/\d{4}[A-Z]{3}/);
  if (matchAll) return matchAll[0];

  return null;
}

// ====================================
// Búsqueda de VIN
// ====================================

function findVIN(buf: Buffer): string | null {
  const vinPattern = /[A-HJ-NPR-Z0-9]{17}/;
  
  for (let i = 0; i < buf.length - 17; i++) {
    const chunk = readAscii(buf, i, 17);
    if (chunk.length === 17 && vinPattern.test(chunk)) {
      if (!chunk.match(/^[0]{17}$/) && !chunk.match(/^[F]{17}$/)) {
        return chunk;
      }
    }
  }
  return null;
}

// ====================================
// Búsqueda de datos del conductor
// ====================================

function findDriverData(buf: Buffer): DriverIdentification {
  return {
    surname: null,
    firstName: null,
    cardNumber: null, // No se extrae del binario — viene del filename
    cardExpiry: null,
    issuingNation: null,
  };
}

// ====================================
// Búsqueda de timestamps
// ====================================

function findTimestampPositions(buf: Buffer, minDate?: Date, maxDate?: Date): TimestampPosition[] {
  const results: TimestampPosition[] = [];
  const seenOffsets = new Set<number>();
  
  const tsMin = minDate ? Math.floor(minDate.getTime() / 1000) : 946684800;
  const tsMax = maxDate ? Math.floor(maxDate.getTime() / 1000) : 2051222400;
  
  const SECONDS_PER_DAY = 86400;
  
  // Pass 1: timestamps alineados a medianoche (más fiable)
  for (let i = 0; i < buf.length - 3; i++) {
    const ts = readUint32BE(buf, i);
    if (ts >= tsMin && ts <= tsMax && !seenOffsets.has(i)) {
      if (ts % SECONDS_PER_DAY === 0) {
        seenOffsets.add(i);
        results.push({ offset: i, date: new Date(ts * 1000) });
      }
    }
    if (results.length >= 500) break;
  }
  
  // Pass 2: si pocos resultados, añadir no-medianoche
  if (results.length < 10) {
    for (let i = 0; i < buf.length - 3; i++) {
      if (seenOffsets.has(i)) continue;
      const ts = readUint32BE(buf, i);
      if (ts >= tsMin && ts <= tsMax) {
        seenOffsets.add(i);
        results.push({ offset: i, date: new Date(ts * 1000) });
      }
      if (results.length >= 500) break;
    }
  }
  
  results.sort((a, b) => a.offset - b.offset);
  return results;
}

function findAllTimestamps(buf: Buffer, fileDate?: Date | null): Date[] {
  const minDate = fileDate ? new Date(fileDate.getTime() - 3 * 365.25 * 24 * 60 * 60 * 1000) : undefined;
  const maxDate = fileDate ? new Date(fileDate.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined;
  return findTimestampPositions(buf, minDate, maxDate).map(tp => tp.date);
}

// ====================================
// Vehicle Used Records extraction (DRIVER_CARD)
// ====================================

interface VehicleUsedRecord {
  vrn: string;
  startDate: Date | null;
  endDate: Date | null;
  odometerStart: number | null;
  odometerEnd: number | null;
}

/**
 * Finds vehicle registration numbers embedded in DRIVER_CARD files.
 * EU spec: CardVehiclesUsed structure contains VRN (reg number) with timestamps.
 * 
 * We scan for Spanish plate patterns (NNNNXXX or XXNNNNXX) near timestamps.
 */
function findVehicleUsedRecords(buf: Buffer): VehicleUsedRecord[] {
  const results: VehicleUsedRecord[] = [];
  const seenPlates = new Map<string, VehicleUsedRecord>();
  
  // Spanish plate patterns
  const platePatternNew = /^(\d{4}[A-Z]{3})$/;
  const platePatternOld = /^([A-Z]{1,2}\d{4}[A-Z]{2,3})$/;
  
  // Scan for plate-like ASCII strings near timestamps
  for (let i = 0; i < buf.length - 20; i++) {
    // Try to read 7-8 chars at this position
    const chunk7 = readAscii(buf, i, 7);
    const chunk8 = readAscii(buf, i, 8);
    
    let plate: string | null = null;
    if (chunk7.length === 7 && platePatternNew.test(chunk7)) {
      plate = chunk7;
    } else if (chunk8.length >= 7) {
      const matchOld = chunk8.match(platePatternOld);
      if (matchOld) plate = matchOld[1];
    }
    
    if (!plate) continue;
    
    // Found a plate — look for timestamps nearby (within ±20 bytes)
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // In the EU spec, vehicle usage records have the structure:
    // VRN(15) + Nation(2) + vehicleFirstUse(4) + vehicleLastUse(4)
    // Or similar layouts. Timestamps are usually after the VRN+padding.
    for (const tsOffset of [15, 17, 19, 21, -4, -8]) {
      const tsPos = i + tsOffset;
      if (tsPos < 0 || tsPos + 4 > buf.length) continue;
      
      const ts = readTimestamp(buf, tsPos);
      if (ts) {
        if (!startDate || ts < startDate) startDate = ts;
        if (!endDate || ts > endDate) endDate = ts;
      }
    }
    
    // Deduplicate: keep the one with most info
    const normalized = plate.toUpperCase().replace(/[\s\-]/g, '');
    if (!seenPlates.has(normalized) || (startDate && !seenPlates.get(normalized)!.startDate)) {
      seenPlates.set(normalized, { vrn: normalized, startDate, endDate, odometerStart: null, odometerEnd: null });
    }
    
    // Skip past this plate to avoid double-detection
    i += plate.length - 1;
  }
  
  return Array.from(seenPlates.values());
}

// ====================================
// Utilidades de nombre de archivo
// ====================================

function extractPlateFromFileName(name: string): string | null {
  const match = name.match(/(\d{4}[A-Z]{3})/i);
  if (match) return match[1].toUpperCase();
  
  const match2 = name.match(/([A-Z]{1,2}[\-\s]?\d{4}[\-\s]?[A-Z]{2,3})/i);
  if (match2) return match2[1].toUpperCase().replace(/[\s-]/g, '');
  
  return null;
}

function extractDateFromFileName(name: string): Date | null {
  const match = name.match(/(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (match) {
    const d = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2040) return d;
  }
  return null;
}

function extractCardInfoFromFileName(fileName: string): { cardNumber?: string; dni?: string } {
  const baseName = fileName.split(/[\\/]/).pop() || '';
  const match = baseName.match(/E(\d{8}[A-Za-z])(\d{4,8})/);
  if (match) {
    const dni = match[1].toUpperCase();
    const version = match[2];
    return { cardNumber: `E${dni}${version}`, dni };
  }
  return {};
}
