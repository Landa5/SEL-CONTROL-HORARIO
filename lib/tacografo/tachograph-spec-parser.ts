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
 * Parses VehicleUsedRecords from the driver card binary according to EU regulation.
 * Structure per record (31 bytes):
 * - vehicleOdometerBegin: 3 bytes (big-endian, km)
 * - vehicleOdometerEnd: 3 bytes (big-endian, km) 
 * - vehicleFirstUse: 4 bytes (unix timestamp)
 * - vehicleLastUse: 4 bytes (unix timestamp)
 * - vehicleRegistrationNation: 1 byte
 * - vehicleRegistrationNumber: 14 bytes (ASCII, padded with spaces/nulls)
 * - padding: 2 bytes
 * Total: 31 bytes per record
 */
function scanForVehicles(buf: Buffer): { vrn: string; startDate: Date | null; endDate: Date | null }[] {
  const RECORD_SIZE = 31;
  const results: { vrn: string; startDate: Date | null; endDate: Date | null; score: number }[] = [];
  const seen = new Set<string>();
  
  // Strategy 1: Look for structured VehicleUsedRecords
  for (let i = 0; i <= buf.length - RECORD_SIZE; i++) {
    // Read potential timestamps at offset 6 and 10
    const ts1 = readUint32BE(buf, i + 6);
    const ts2 = readUint32BE(buf, i + 10);
    
    // Both must be valid timestamps
    if (ts1 < TS_MIN || ts1 > TS_MAX || ts2 < TS_MIN || ts2 > TS_MAX) continue;
    
    const d1 = new Date(ts1 * 1000);
    const d2 = new Date(ts2 * 1000);
    if (d1.getFullYear() < 2010 || d1.getFullYear() > 2040) continue;
    if (d2.getFullYear() < 2010 || d2.getFullYear() > 2040) continue;
    
    // ts1 (firstUse) should be <= ts2 (lastUse)
    if (ts1 > ts2) continue;
    
    // Read odometers (3 bytes each, big-endian)
    const odoStart = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
    const odoEnd = (buf[i + 3] << 16) | (buf[i + 4] << 8) | buf[i + 5];
    
    // Odometers should be reasonable (0-9999999 km) and end >= start
    if (odoStart > 9999999 || odoEnd > 9999999) continue;
    if (odoEnd < odoStart && odoEnd !== 0) continue;
    
    // Nation code at offset 14 (should be 0-255, typically small number for EU countries)
    const nationCode = buf[i + 14];
    
    // VRN at offset 15, 14 bytes
    const vrnRaw = readAsciiClean(buf, i + 15, 14).trim();
    
    // Must contain a Spanish plate pattern (4 digits + 2-3 letters)
    const plateMatch = vrnRaw.match(/(\d{4}[A-Z]{2,3})/);
    if (!plateMatch) continue;
    
    const plate = plateMatch[1];
    
    // Score this record based on quality indicators
    let score = 0;
    if (odoStart > 0 && odoEnd > 0) score += 2; // valid odometers
    if (nationCode > 0 && nationCode < 100) score += 1; // valid nation code
    if (ts2 - ts1 < 86400 * 365) score += 1; // usage period < 1 year (plausible)
    if (ts2 - ts1 > 0) score += 1; // actually has a time range
    
    const key = `${plate}_${ts1}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ vrn: plate, startDate: d1, endDate: d2, score });
    }
    
    // Don't skip ahead too far - records might not be contiguous
  }
  
  // If structured parsing found results, use them (prefer high-score records)
  if (results.length > 0) {
    // Sort by score (best first) and deduplicate by plate+daterange
    results.sort((a, b) => b.score - a.score);
    return results.map(({ vrn, startDate, endDate }) => ({ vrn, startDate, endDate }));
  }
  
  // Strategy 2: Fallback to simple plate pattern scan if no structured records found
  const fallbackResults: { vrn: string; startDate: Date | null; endDate: Date | null }[] = [];
  for (let i = 0; i < buf.length - 7; i++) {
    const chunk = readAsciiClean(buf, i, 14);
    const match = chunk.match(/(\d{4}[A-Z]{2,3})/);
    if (!match) continue;
    const plate = match[1];
    const key2 = `${plate}_fallback`;
    if (!seen.has(key2)) {
      seen.add(key2);
      fallbackResults.push({ vrn: plate, startDate: null, endDate: null });
    }
    i += 6;
  }
  
  return fallbackResults;
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
    for (const vr of vehicleRecords) {
      warnings.push(`[DIAG-VEH] ${vr.vrn} range: ${vr.startDate?.toISOString().substring(0, 10) || '?'} → ${vr.endDate?.toISOString().substring(0, 10) || '?'}`);
    }
  }
  
  // 3. Convert daily records to BinaryRawEvent[]
  const rawDriverId = metadata.cardNumber || null;
  
  for (const day of dailyRecords) {
    let vehicleId: string | null = null;
    // Try matching vehicle records by date range
    // A vehicle record covers dates where the driver used that vehicle
    for (const vr of vehicleRecords) {
      const vrStart = vr.startDate ? vr.startDate.toISOString().substring(0, 10) : null;
      const vrEnd = vr.endDate ? vr.endDate.toISOString().substring(0, 10) : null;
      if (vrStart && vrEnd && day.dateStr >= vrStart && day.dateStr <= vrEnd) {
        vehicleId = vr.vrn;
        break;
      }
      // Also check if only startDate matches the day (single-day usage)
      if (vrStart && vrStart === day.dateStr) {
        vehicleId = vr.vrn;
        break;
      }
    }
    if (!vehicleId && metadata.plateNumber) {
      // Only use primary plate as fallback if no vehicle records exist at all
      if (vehicleRecords.length === 0) {
        vehicleId = metadata.plateNumber;
      }
    }
    warnings.push(`[DIAG-DAY] ${day.dateStr}: assigned vehicle=${vehicleId || 'NONE'}, activities=${day.activities.length}`);
    
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i];
      const nextAct = i + 1 < day.activities.length ? day.activities[i + 1] : null;
      
      const startTime = new Date(day.date.getTime() + act.minutes * 60000);
      
      if (nextAct) {
        // Normal case: activity runs until next activity starts
        const endMinutes = nextAct.minutes;
        if (endMinutes <= act.minutes) continue;
        
        const endTime = new Date(day.date.getTime() + endMinutes * 60000);
        const durationMinutes = endMinutes - act.minutes;
        
        // If card is NOT inserted, the tachograph records the default activity
        // (usually OTHER_WORK or AVAILABILITY). This is NOT real driver activity.
        // Per EU regulation, when card is out = driver is at REST.
        const effectiveActivityType = act.cardInserted === false && act.activityType !== 'REST' && act.activityType !== 'DRIVING'
          ? 'REST' 
          : act.activityType;
        
        rawEvents.push({
          rawStartAt: startTime,
          rawEndAt: endTime,
          rawActivityType: effectiveActivityType,
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
            originalActivityType: act.activityType !== effectiveActivityType ? act.activityType : undefined,
          } as any,
          extractionMethod: act.cardInserted === false && act.activityType !== effectiveActivityType ? 'derived' : 'spec',
          extractionNotes: `Scan: ${day.dateStr} ${effectiveActivityType}${act.cardInserted === false ? '(card-out)' : ''} ${act.minutes}m-${endMinutes}m (${durationMinutes}min)`,
          extractionStatus: 'OK',
        });
      } else {
        // LAST activity of the day: the driver closed the disc / removed card.
        // After this point, the driver is implicitly at REST until midnight.
        // We emit the last activity as a zero-duration marker only if it's REST,
        // or convert it to REST from its start until midnight.
        
        const endMinutes = 1440;
        const endTime = new Date(day.date.getTime() + endMinutes * 60000);
        const durationMinutes = endMinutes - act.minutes;
        
        if (durationMinutes <= 0) continue;
        
        // If the last change is already REST, just emit it normally
        // If it's anything else (OTHER_WORK, AVAILABILITY, DRIVING), 
        // the tachograph records the last activity state at card removal.
        // Per EU regulation, time after card withdrawal = REST.
        const lastActivityType = act.cardInserted === false ? 'REST' : act.activityType;
        
        // If card is still inserted and activity is not REST, emit the original 
        // activity for a short buffer (max 1 min) then REST for the remainder
        if (act.cardInserted !== false && act.activityType !== 'REST' && durationMinutes > 1) {
          // Emit 1-minute of the recorded activity (the actual last moment)
          rawEvents.push({
            rawStartAt: startTime,
            rawEndAt: new Date(startTime.getTime() + 60000),
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
              isLastOfDay: true,
            } as any,
            extractionMethod: 'spec',
            extractionNotes: `Scan: ${day.dateStr} ${act.activityType} ${act.minutes}m-${act.minutes + 1}m (1min, last-of-day)`,
            extractionStatus: 'OK',
          });
          
          // Then REST until midnight
          const restStart = new Date(startTime.getTime() + 60000);
          rawEvents.push({
            rawStartAt: restStart,
            rawEndAt: endTime,
            rawActivityType: 'REST',
            rawDriverIdentifier: rawDriverId,
            rawVehicleIdentifier: vehicleId,
            rawPayload: {
              slot: act.slot,
              cardInserted: false,
              byteOffset: day.byteOffset,
              headerOffset: 0,
              dayTimestamp: Math.floor(day.date.getTime() / 1000),
              driverStatus: act.driverStatus,
              presenceCounter: day.presenceCounter,
              dayDistance: day.dayDistance,
              activityCode: 0, // REST = 00
              startMinutes: act.minutes + 1,
              isDerivedRest: true,
            } as any,
            extractionMethod: 'derived',
            extractionNotes: `Scan: ${day.dateStr} REST(end-of-day) ${act.minutes + 1}m-${endMinutes}m (${durationMinutes - 1}min)`,
            extractionStatus: 'OK',
          });
        } else {
          // Card not inserted or already REST: emit as REST until midnight
          rawEvents.push({
            rawStartAt: startTime,
            rawEndAt: endTime,
            rawActivityType: lastActivityType,
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
              isLastOfDay: true,
            } as any,
            extractionMethod: act.activityType === 'REST' ? 'spec' : 'derived',
            extractionNotes: `Scan: ${day.dateStr} ${lastActivityType}(end-of-day) ${act.minutes}m-${endMinutes}m (${durationMinutes}min)`,
            extractionStatus: 'OK',
          });
        }
      }
    }
    
    // POST-PROCESSING: Fix tachograph artifact where card left in slot overnight
    // If a day starts with OTHER_WORK or AVAILABILITY (before 06:00 UTC),
    // followed by REST, and there is no DRIVING before it, convert to REST.
    // This handles the case where the driver sleeps with the card inserted.
    const dayEvents = rawEvents.filter(e => {
      const eDate = e.rawStartAt.toISOString().substring(0, 10);
      return eDate === day.dateStr;
    });
    if (dayEvents.length >= 2) {
      const sorted = dayEvents.sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
      // Find events that could be overnight artifacts
      for (let ei = 0; ei < sorted.length; ei++) {
        const ev = sorted[ei];
        const evHour = ev.rawStartAt.getUTCHours();
        if (evHour >= 6) break; // Only check events before 06:00 UTC
        if (ev.rawActivityType === 'DRIVING') break; // Stop if we hit real driving
        if (ev.rawActivityType === 'REST') continue; // REST is fine, skip
        // It's OTHER_WORK or AVAILABILITY before 06:00 and before any DRIVING
        const nextEv = ei + 1 < sorted.length ? sorted[ei + 1] : null;
        if (nextEv && nextEv.rawActivityType === 'REST') {
          // This is likely a tachograph artifact - convert to REST
          const originalType = ev.rawActivityType;
          ev.rawActivityType = 'REST';
          ev.extractionMethod = 'derived';
          ev.extractionNotes = (ev.extractionNotes || '') + ` [auto-fixed: overnight card-in artifact ${originalType} → REST]`;
          warnings.push(`[FIX] ${day.dateStr}: converted ${originalType} at ${evHour}:00 UTC to REST (card-in overnight artifact)`);
        }
      }
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
