/**
 * TachographSpecParser v2 — Parser directo de archivos TGD de tarjeta de conductor
 * 
 * Estrategia: en vez de buscar tags TLV (que varían según el software de descarga),
 * busca DIRECTAMENTE los patrones de CardActivityDailyRecord en el buffer binario.
 * 
 * Un CardActivityDailyRecord tiene esta estructura fija (EU 2016/799):
 *   [recordLength:2][recordDate:4][presenceCounter:2][dayDistance:2][activities:2*N]
 * 
 * Donde:
 *   - recordLength = total bytes del record (incluyendo este campo)
 *   - recordDate = Unix timestamp UTC aligned to midnight (divisible por 86400)
 *   - presenceCounter = incrementa por cada día de uso
 *   - dayDistance = km recorridos en el día
 *   - activities = N registros de ActivityChangeInfo de 2 bytes
 * 
 * ActivityChangeInfo (16 bits):
 *   bit 15:    slot (0=driver, 1=co-driver)
 *   bit 14:    driving status (0=single, 1=crew)
 *   bit 13:    card status (0=not inserted, 1=inserted)  
 *   bits 12-11: activity (00=REST, 01=AVAILABILITY, 10=OTHER_WORK, 11=DRIVING)
 *   bits 10-0:  time (minutes from 00:00, 0-1439)
 */

import type { BinaryRawEvent, BinaryParseResult } from './tachograph-binary-parser';

// ====================================
// Constantes  
// ====================================

const ACTIVITY_CODES: Record<number, string> = {
  0: 'REST',
  1: 'AVAILABILITY',
  2: 'OTHER_WORK',
  3: 'DRIVING',
};

const SECONDS_PER_DAY = 86400;
// Rango de timestamps válidos: 2010-01-01 a 2040-01-01
const TS_MIN = 1262304000; // 2010-01-01
const TS_MAX = 2208988800; // 2040-01-01

// ====================================
// Tipos internos
// ====================================

interface DailyRecord {
  date: Date;
  dateStr: string;
  recordLength: number;
  presenceCounter: number;
  dayDistance: number;
  activities: ActivityChange[];
  byteOffset: number;
}

interface ActivityChange {
  slot: number;
  driverStatus: number;
  cardInserted: boolean;
  activityCode: number;
  activityType: string;
  minutes: number;
}

// ====================================
// Binary helpers
// ====================================

function readUint16BE(buf: Buffer, offset: number): number {
  if (offset + 1 >= buf.length) return 0;
  return (buf[offset] << 8) | buf[offset + 1];
}

function readUint32BE(buf: Buffer, offset: number): number {
  if (offset + 3 >= buf.length) return 0;
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readAsciiClean(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) length = buf.length - offset;
  if (length <= 0) return '';
  return Array.from(buf.subarray(offset, offset + length))
    .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '')
    .join('')
    .trim();
}

// ====================================
// Core: Direct Record Scan
// ====================================

/**
 * Scans the entire buffer for CardActivityDailyRecord patterns.
 * 
 * Detection: at each position i, check if:
 *   - bytes[i..i+1] (recordLength) is between 12 and 1000
 *   - bytes[i+2..i+5] (timestamp) is a midnight UTC value in valid range
 *   - bytes[i+10..i+11] (first activity) has valid minutes (0-1439) and non-zero
 *   - recordLength fits within buffer bounds
 * 
 * If a valid record is found, parse all its activities and advance by recordLength.
 * If not, advance by 1 byte.
 */
function scanForDailyRecords(buf: Buffer): DailyRecord[] {
  const records: DailyRecord[] = [];
  const seenDates = new Set<string>();
  
  let i = 0;
  const maxPos = buf.length - 12; // minimum record is 12 bytes
  
  while (i < maxPos) {
    const recordLength = readUint16BE(buf, i);
    
    // Quick reject: invalid record length
    if (recordLength < 12 || recordLength > 1200 || i + recordLength > buf.length) {
      i++;
      continue;
    }
    
    // Check timestamp at offset +2
    const ts = readUint32BE(buf, i + 2);
    if (ts < TS_MIN || ts > TS_MAX || ts % SECONDS_PER_DAY !== 0) {
      i++;
      continue;
    }
    
    // Check first activity at offset +10 (must have valid minutes and non-zero)
    const firstAct = readUint16BE(buf, i + 10);
    if (firstAct === 0 || firstAct === 0xFFFF) {
      i++;
      continue;
    }
    const firstActMinutes = firstAct & 0x07FF;
    if (firstActMinutes > 1439) {
      i++;
      continue;
    }
    
    // Additional validation: number of activities should make sense
    const activityBytes = recordLength - 10; // after header
    if (activityBytes < 2 || activityBytes % 2 !== 0) {
      i++;
      continue;
    }
    const numActivities = activityBytes / 2;
    if (numActivities > 500) { // too many activities for one day
      i++;
      continue;
    }
    
    // Validate at least 2 activity records have valid minutes
    let validActCount = 0;
    for (let a = 0; a < Math.min(numActivities, 5); a++) {
      const act = readUint16BE(buf, i + 10 + a * 2);
      if (act !== 0 && act !== 0xFFFF) {
        const mins = act & 0x07FF;
        if (mins <= 1439) validActCount++;
      }
    }
    
    if (validActCount < 1) {
      i++;
      continue;
    }
    
    // SUCCESS: This is a valid CardActivityDailyRecord!
    const date = new Date(ts * 1000);
    const dateStr = date.toISOString().substring(0, 10);
    
    // Parse all activities
    const activities: ActivityChange[] = [];
    for (let a = 0; a < numActivities; a++) {
      const word = readUint16BE(buf, i + 10 + a * 2);
      if (word === 0 || word === 0xFFFF) continue;
      
      const slot = (word >> 15) & 1;
      const driverStatus = (word >> 14) & 1;
      const cardInserted = ((word >> 13) & 1) === 1;
      const activityCode = (word >> 11) & 0x03;
      const minutes = word & 0x07FF;
      
      if (minutes > 1439) continue;
      
      activities.push({
        slot,
        driverStatus,
        cardInserted,
        activityCode,
        activityType: ACTIVITY_CODES[activityCode] || 'UNKNOWN',
        minutes,
      });
    }
    
    // Sort activities by time
    activities.sort((a, b) => a.minutes - b.minutes);
    
    // Avoid duplicates (cyclical buffer can have overlapping data)
    if (!seenDates.has(dateStr) && activities.length > 0) {
      seenDates.add(dateStr);
      records.push({
        date,
        dateStr,
        recordLength,
        presenceCounter: readUint16BE(buf, i + 6),
        dayDistance: readUint16BE(buf, i + 8),
        activities,
        byteOffset: i,
      });
    }
    
    // Advance past this record
    i += recordLength;
  }
  
  // Sort by date
  records.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return records;
}

// ====================================
// Vehicle Registration Scanner
// ====================================

/**
 * Scans for Spanish plate patterns (e.g. "4563LZS", "9946GWZ")
 * and nearby timestamps.
 */
function scanForVehicles(buf: Buffer): { vrn: string; startDate: Date | null; endDate: Date | null }[] {
  const results: { vrn: string; startDate: Date | null; endDate: Date | null }[] = [];
  const seen = new Set<string>();
  
  // Spanish plates: 4 digits + 2-3 uppercase letters
  for (let i = 0; i < buf.length - 7; i++) {
    const chunk = readAsciiClean(buf, i, 14);
    const match = chunk.match(/(\d{4}[A-Z]{2,3})/);
    if (!match) continue;
    
    const plate = match[1];
    
    // Look for timestamps before the plate (within 20 bytes)
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    for (let tOff = Math.max(0, i - 20); tOff < i; tOff++) {
      const ts = readUint32BE(buf, tOff);
      if (ts >= TS_MIN && ts <= TS_MAX) {
        const d = new Date(ts * 1000);
        if (d.getFullYear() >= 2010 && d.getFullYear() <= 2040) {
          if (!startDate) {
            startDate = d;
          } else if (!endDate) {
            endDate = d;
          }
        }
      }
    }
    
    const key = `${plate}_${startDate?.toISOString() || 'x'}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ vrn: plate, startDate, endDate });
    }
    
    i += 6; // skip past plate
  }
  
  return results;
}

// ====================================
// Main Parser Function
// ====================================

export function parseDriverCardSpec(buffer: Buffer, fileName: string): BinaryParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rawEvents: BinaryRawEvent[] = [];
  const metadata: BinaryParseResult['metadata'] = {};
  
  // Extract metadata from filename
  const cardInfo = extractCardInfoFromFilename(fileName);
  if (cardInfo.cardNumber) metadata.cardNumber = cardInfo.cardNumber;
  if (cardInfo.dni) metadata.driverDni = cardInfo.dni;
  
  // Diagnostic: hex dump first 200 bytes
  const hexFirst200 = Array.from(buffer.subarray(0, Math.min(200, buffer.length)))
    .map(b => b.toString(16).padStart(2, '0')).join(' ');
  warnings.push(`[DIAG] File: ${buffer.length} bytes. First 200: ${hexFirst200}`);
  
  // 1. DIRECT SCAN for CardActivityDailyRecord patterns
  const dailyRecords = scanForDailyRecords(buffer);
  
  warnings.push(`[DIAG] Direct scan found ${dailyRecords.length} daily records.`);
  
  if (dailyRecords.length > 0) {
    const dateRange = `${dailyRecords[0].dateStr} — ${dailyRecords[dailyRecords.length - 1].dateStr}`;
    warnings.push(`[DIAG] Date range: ${dateRange}`);
    
    // List first 10 and last 5 dates for verification
    const firstDates = dailyRecords.slice(0, 10).map(r => r.dateStr).join(', ');
    const lastDates = dailyRecords.slice(-5).map(r => r.dateStr).join(', ');
    warnings.push(`[DIAG] First dates: ${firstDates}`);
    warnings.push(`[DIAG] Last dates: ${lastDates}`);
  }
  
  // 2. Scan for vehicles
  const vehicleRecords = scanForVehicles(buffer);
  if (vehicleRecords.length > 0) {
    metadata.vehicleUsedRecords = vehicleRecords.map(vr => ({
      vrn: vr.vrn,
      startDate: vr.startDate,
      endDate: vr.endDate,
      odometerStart: null,
      odometerEnd: null,
    }));
    
    // Primary plate
    const plateCounts = new Map<string, number>();
    for (const vr of vehicleRecords) {
      plateCounts.set(vr.vrn, (plateCounts.get(vr.vrn) || 0) + 1);
    }
    const primaryPlate = [...plateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (primaryPlate) metadata.plateNumber = primaryPlate;
    
    warnings.push(`[DIAG] ${vehicleRecords.length} vehicles found. Primary: ${primaryPlate || 'none'}`);
  }
  
  // 3. Convert daily records to BinaryRawEvent[]
  const rawDriverId = metadata.cardNumber || null;
  
  for (const day of dailyRecords) {
    let vehicleId: string | null = null;
    for (const vr of vehicleRecords) {
      const vrStart = vr.startDate ? vr.startDate.toISOString().substring(0, 10) : null;
      const vrEnd = vr.endDate ? vr.endDate.toISOString().substring(0, 10) : null;
      if (vrStart && vrEnd && day.dateStr >= vrStart && day.dateStr <= vrEnd) {
        vehicleId = vr.vrn;
        break;
      }
    }
    if (!vehicleId && metadata.plateNumber) {
      vehicleId = metadata.plateNumber;
    }
    
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i];
      const nextAct = i + 1 < day.activities.length ? day.activities[i + 1] : null;
      
      const startTime = new Date(day.date.getTime() + act.minutes * 60000);
      const endMinutes = nextAct ? nextAct.minutes : 1440;
      const endTime = new Date(day.date.getTime() + endMinutes * 60000);
      
      if (endMinutes <= act.minutes) continue;
      
      const durationMinutes = endMinutes - act.minutes;
      
      rawEvents.push({
        rawStartAt: startTime,
        rawEndAt: endTime,
        rawActivityType: act.activityType,
        rawDriverIdentifier: rawDriverId,
        rawVehicleIdentifier: vehicleId,
        rawPayload: {
          slot: act.slot,
          cardInserted: act.cardInserted,
          byteOffset: day.byteOffset,
          headerOffset: 0,
          dayTimestamp: Math.floor(day.date.getTime() / 1000),
          driverStatus: act.driverStatus,
          presenceCounter: day.presenceCounter,
          dayDistance: day.dayDistance,
          activityCode: act.activityCode,
          startMinutes: act.minutes,
        } as any,
        extractionMethod: 'spec',
        extractionNotes: `Scan: ${day.dateStr} ${act.activityType} ${act.minutes}m-${endMinutes}m (${durationMinutes}min)`,
        extractionStatus: 'OK',
      });
    }
  }
  
  // Sort events
  rawEvents.sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
  
  // Date range
  if (rawEvents.length > 0) {
    metadata.dateFrom = rawEvents[0].rawStartAt;
    metadata.dateTo = rawEvents[rawEvents.length - 1].rawEndAt;
  }
  
  const uniqueDays = new Set(dailyRecords.map(r => r.dateStr));
  warnings.push(
    `Spec parser v2: ${rawEvents.length} raw events from ${uniqueDays.size} days, ` +
    `${vehicleRecords.length} vehicle records.`
  );
  
  return {
    success: rawEvents.length > 0,
    fileType: 'DRIVER_CARD',
    parserVersion: 'spec-v2',
    metadata,
    rawEvents,
    warnings,
    errors,
  };
}

// ====================================
// Utilities
// ====================================

function extractCardInfoFromFilename(fileName: string): { cardNumber?: string; dni?: string } {
  const baseName = fileName.split(/[\\/]/).pop() || '';
  const match = baseName.match(/E(\d{8}[A-Za-z])(\d{4,8})/);
  if (match) {
    const dni = match[1].toUpperCase();
    const version = match[2];
    return { cardNumber: `E${dni}${version}`, dni };
  }
  return {};
}
