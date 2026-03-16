/**
 * TachographSpecParser — Parser según especificación EU 2016/799 Annex IC
 * 
 * Parsea archivos TGD/DDD de tarjeta de conductor (DRIVER_CARD) usando
 * la estructura TLV real del estándar EU.
 * 
 * Bloque principal: EF_Driver_Activity_Data (tag 0x0506)
 * Estructura: CardDriverActivity = {
 *   activityPointerOldestDayRecord  (2 bytes),
 *   activityPointerNewestRecord     (2 bytes),
 *   activityDailyRecords — buffer cíclico de CardActivityDailyRecord
 * }
 * 
 * Cada CardActivityDailyRecord = {
 *   activityRecordLength       (2 bytes),
 *   activityRecordDate          (4 bytes — TimeReal, Unix timestamp midnight UTC),
 *   activityDailyPresenceCounter (2 bytes),
 *   activityDayDistance          (2 bytes),
 *   activityChangeInfo[]         (2 bytes each)
 * }
 * 
 * ActivityChangeInfo (16 bits) = {
 *   slot         (bit 15)    — 0=driver, 1=co-driver
 *   driverStatus (bit 14)    — 0=single, 1=crew
 *   cardStatus   (bit 13)    — 0=not inserted, 1=inserted
 *   activity     (bits 12-11) — 00=REST, 01=AVAILABILITY, 10=OTHER_WORK, 11=DRIVING
 *   time         (bits 10-0)  — minutes from midnight (0-1439)
 * }
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

// TLV tags for driver card (EU 2016/799)
const TAG_EF_IDENTIFICATION     = 0x0501;
const TAG_EF_CARD_DOWNLOAD      = 0x0502;
const TAG_EF_DRIVING_LICENCE    = 0x0503;
const TAG_EF_EVENTS_DATA        = 0x0504;
const TAG_EF_FAULTS_DATA        = 0x0505;
const TAG_EF_DRIVER_ACTIVITY    = 0x0506;
const TAG_EF_VEHICLES_USED      = 0x0507;
const TAG_EF_PLACES             = 0x0508;
const TAG_EF_CONTROL_ACTIVITY   = 0x050B;
const TAG_EF_SPECIFIC_CONDITIONS = 0x050C;

// ====================================
// Interfaces internas
// ====================================

interface TLVBlock {
  tag: number;
  offset: number;       // offset of data (after tag + length bytes)
  length: number;       // data length
  headerSize: number;   // tag + length encoding size
}

interface DailyRecord {
  date: Date;
  dateStr: string;       // YYYY-MM-DD
  recordLength: number;
  presenceCounter: number;
  dayDistance: number;    // km
  activities: ActivityChange[];
  byteOffset: number;
}

interface ActivityChange {
  slot: number;          // 0=driver, 1=co-driver
  driverStatus: number;  // 0=single, 1=crew
  cardInserted: boolean;
  activityCode: number;  // 0-3
  activityType: string;  // REST, AVAILABILITY, OTHER_WORK, DRIVING
  minutes: number;       // minutes from midnight
}

interface VehicleUsedRecord {
  vrn: string;           // vehicle registration number
  startDate: Date | null;
  endDate: Date | null;
  nation: string | null;
}

// ====================================
// Binary reading utilities
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

function readAsciiClean(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) length = buf.length - offset;
  if (length <= 0) return '';
  return Array.from(buf.subarray(offset, offset + length))
    .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '')
    .join('')
    .trim();
}

function readTimestamp(buf: Buffer, offset: number): Date | null {
  const ts = readUint32BE(buf, offset);
  if (ts === 0 || ts === 0xffffffff) return null;
  const date = new Date(ts * 1000);
  if (date.getFullYear() >= 2000 && date.getFullYear() <= 2040) return date;
  return null;
}

// ====================================
// TLV Scanner
// ====================================

/**
 * Scans the buffer for known TLV tags (2-byte tags).
 * Length encoding per EU spec:
 *   - If first byte <= 0x7F: length = 1 byte
 *   - If first byte == 0x81: length = next 1 byte
 *   - If first byte == 0x82: length = next 2 bytes (BE)
 */
function findTLVBlocks(buf: Buffer): TLVBlock[] {
  const blocks: TLVBlock[] = [];
  
  // Known tags to look for
  const knownTags = new Set([
    TAG_EF_IDENTIFICATION, TAG_EF_CARD_DOWNLOAD, TAG_EF_DRIVING_LICENCE,
    TAG_EF_EVENTS_DATA, TAG_EF_FAULTS_DATA, TAG_EF_DRIVER_ACTIVITY,
    TAG_EF_VEHICLES_USED, TAG_EF_PLACES, TAG_EF_CONTROL_ACTIVITY,
    TAG_EF_SPECIFIC_CONDITIONS,
  ]);
  
  for (let i = 0; i < buf.length - 4; i++) {
    const tag = readUint16BE(buf, i);
    if (!knownTags.has(tag)) continue;
    
    // Read length
    let dataLength = 0;
    let headerSize = 2; // tag = 2 bytes
    
    const lenByte = buf[i + 2];
    if (lenByte <= 0x7f) {
      dataLength = lenByte;
      headerSize += 1;
    } else if (lenByte === 0x81) {
      if (i + 3 >= buf.length) continue;
      dataLength = buf[i + 3];
      headerSize += 2;
    } else if (lenByte === 0x82) {
      if (i + 4 >= buf.length) continue;
      dataLength = readUint16BE(buf, i + 3);
      headerSize += 3;
    } else {
      continue; // Unknown length encoding
    }
    
    // Sanity checks
    if (dataLength <= 0) continue;
    if (dataLength > 100000) continue; // driver card data shouldn't be > 100KB per block
    if (i + headerSize + dataLength > buf.length) continue;
    
    blocks.push({
      tag,
      offset: i + headerSize,
      length: dataLength,
      headerSize,
    });
    
    // Skip past this block to avoid nested false matches
    // Don't skip — we want to find all occurrences since there may be
    // both a data block and a signature block for each EF
  }
  
  return blocks;
}

// ====================================
// Driver Activity Data Parser  
// ====================================

/**
 * Parses EF_Driver_Activity_Data (tag 0x0506).
 * 
 * Structure:
 *   Bytes 0-1:   activityPointerOldestDayRecord (offset relative to byte 4)
 *   Bytes 2-3:   activityPointerNewestRecord (offset relative to byte 4)
 *   Bytes 4+:    Cyclical buffer of CardActivityDailyRecord entries
 * 
 * Each CardActivityDailyRecord:
 *   Bytes 0-1:   activityRecordLength (total record length including this field)
 *   Bytes 2-5:   activityRecordDate (TimeReal — Unix timestamp, midnight UTC)
 *   Bytes 6-7:   activityDailyPresenceCounter
 *   Bytes 8-9:   activityDayDistance (in km)
 *   Bytes 10+:   ActivityChangeInfo records (2 bytes each)
 */
function parseDriverActivityData(buf: Buffer, offset: number, length: number): DailyRecord[] {
  if (length < 4) return [];
  
  const oldestDayPtr = readUint16BE(buf, offset);
  const newestRecPtr = readUint16BE(buf, offset + 2);
  
  const dataStart = offset + 4;       // start of cyclical buffer
  const dataEnd = offset + length;    // end of data
  const dataSize = dataEnd - dataStart;
  
  if (dataSize < 10) return [];
  
  const records: DailyRecord[] = [];
  const seen = new Set<string>();
  
  // Strategy: scan the buffer linearly for valid daily records.
  // Start from oldest day pointer and read forward.
  // Because it's a cyclical buffer, we may need to wrap around.
  
  let pos = dataStart + oldestDayPtr;
  let maxIterations = 500; // safety limit
  let totalBytesRead = 0;
  
  while (maxIterations-- > 0 && totalBytesRead < dataSize) {
    // Wrap around if past end
    if (pos >= dataEnd) {
      pos = dataStart + ((pos - dataStart) % dataSize);
    }
    
    // Read record header
    if (pos + 10 > dataEnd) {
      // Record header would cross boundary — try wrapping
      if (totalBytesRead > 0) break;
      pos = dataStart;
      continue;
    }
    
    const recordLength = readUint16BE(buf, pos);
    
    // Validate record length
    if (recordLength === 0 || recordLength === 0xFFFF) {
      // Empty slot — skip 2 bytes and try next position  
      pos += 2;
      totalBytesRead += 2;
      continue;
    }
    
    if (recordLength < 10 || recordLength > 2000) {
      // Invalid — move forward and try to find next valid record
      pos += 2;
      totalBytesRead += 2;
      continue;
    }
    
    // Read date
    const recordDateTs = readUint32BE(buf, pos + 2);
    if (recordDateTs === 0 || recordDateTs === 0xFFFFFFFF) {
      pos += recordLength;
      totalBytesRead += recordLength;
      continue;
    }
    
    const recordDate = new Date(recordDateTs * 1000);
    if (recordDate.getFullYear() < 2000 || recordDate.getFullYear() > 2040) {
      pos += recordLength;
      totalBytesRead += recordLength;
      continue;
    }
    
    const dateStr = recordDate.toISOString().substring(0, 10);
    
    // Skip duplicates (cyclical buffer can show same record twice)
    if (seen.has(dateStr)) {
      pos += recordLength;
      totalBytesRead += recordLength;
      continue;
    }
    seen.add(dateStr);
    
    const presenceCounter = readUint16BE(buf, pos + 6);
    const dayDistance = readUint16BE(buf, pos + 8);
    
    // Parse activity change records
    const activityStartOffset = pos + 10;
    const activityEndOffset = pos + recordLength;
    const activities: ActivityChange[] = [];
    
    for (let aPos = activityStartOffset; aPos + 1 < activityEndOffset && aPos + 1 < dataEnd; aPos += 2) {
      const word = readUint16BE(buf, aPos);
      if (word === 0 || word === 0xFFFF) continue;
      
      const slot = (word >> 15) & 1;
      const driverStatus = (word >> 14) & 1;
      const cardInserted = ((word >> 13) & 1) === 1;
      const activityCode = (word >> 11) & 0x03;
      const minutes = word & 0x07FF;
      
      if (minutes > 1439) continue; // invalid time
      
      activities.push({
        slot,
        driverStatus,
        cardInserted,
        activityCode,
        activityType: ACTIVITY_CODES[activityCode] || 'UNKNOWN',
        minutes,
      });
    }
    
    if (activities.length > 0) {
      // Sort by time
      activities.sort((a, b) => a.minutes - b.minutes);
      
      records.push({
        date: recordDate,
        dateStr,
        recordLength,
        presenceCounter,
        dayDistance,
        activities,
        byteOffset: pos,
      });
    }
    
    pos += recordLength;
    totalBytesRead += recordLength;
  }
  
  // Sort records by date
  records.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return records;
}

// ====================================
// Vehicle Used Records Parser
// ====================================

/**
 * Parses EF_Vehicles_Used (tag 0x0507).
 * 
 * Structure: CardVehiclesUsed = {
 *   vehiclePointerNewestRecord  (2 bytes),
 *   cardVehicleRecords          SET OF CardVehicleRecord
 * }
 * 
 * CardVehicleRecord = {
 *   vehicleOdometerBegin (3 bytes, BCD-encoded km),
 *   vehicleOdometerEnd   (3 bytes, BCD-encoded km),
 *   vehicleFirstUse      (4 bytes, TimeReal),
 *   vehicleLastUse       (4 bytes, TimeReal),
 *   vehicleRegistration  {
 *     codingType         (1 byte),
 *     vehicleRegCountry  (2 bytes, nation numeric),
 *     vehicleRegNumber   (14 bytes, padded ASCII)
 *   },
 *   vuCardIWDataPointer  (2 bytes, optional depending on version)
 * }
 * 
 * Total per record: ~31 bytes (may vary by generation)
 */
function parseVehiclesUsed(buf: Buffer, offset: number, length: number): VehicleUsedRecord[] {
  if (length < 4) return [];
  
  const newestPtr = readUint16BE(buf, offset);
  const dataStart = offset + 2;
  const dataEnd = offset + length;
  
  const records: VehicleUsedRecord[] = [];
  const seen = new Set<string>();
  
  // Each vehicle record is typically 31 bytes for Gen1
  // For Gen2 it might be 33 bytes
  // Try to detect record size
  
  let pos = dataStart;
  let maxIter = 200;
  
  while (pos + 28 <= dataEnd && maxIter-- > 0) {
    // Read odometer values (3 bytes each, BCD or binary)
    // Skip odometers for now, focus on dates and VRN
    
    // Dates at offset +6 and +10
    const vehicleFirstUse = readTimestamp(buf, pos + 6);
    const vehicleLastUse = readTimestamp(buf, pos + 10);
    
    // VRN: skip codingType(1) + country(2), then 14 bytes ASCII
    const vrnOffset = pos + 14 + 1 + 2; // after odometer(6) + dates(8) + codingType(1) + country(2)
    
    // Actually, let me try different offsets since the exact layout varies
    // Common layout: odometer_begin(3) + odometer_end(3) + firstUse(4) + lastUse(4) + codingType(1) + nation(2) + vrn(14)
    // = 31 bytes total
    
    let vrn = '';
    
    // Try reading VRN at expected position
    if (pos + 17 + 14 <= dataEnd) {
      vrn = readAsciiClean(buf, pos + 17, 14);
    }
    
    // Validate VRN (should contain plate-like pattern)
    const plateMatch = vrn.match(/(\d{4}[A-Z]{2,3})|([A-Z]{1,2}\d{4}[A-Z]{2,3})/);
    
    if (plateMatch && vehicleFirstUse) {
      const key = `${plateMatch[0]}_${vehicleFirstUse.toISOString()}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push({
          vrn: plateMatch[0],
          startDate: vehicleFirstUse,
          endDate: vehicleLastUse,
          nation: null,
        });
      }
    }
    
    // If we didn't find a valid record, try alternative offsets
    if (!plateMatch || !vehicleFirstUse) {
      // Try scanning for plate patterns in nearby bytes
      for (let scan = pos; scan < Math.min(pos + 40, dataEnd - 7); scan++) {
        const chunk = readAsciiClean(buf, scan, 14);
        const pm = chunk.match(/(\d{4}[A-Z]{2,3})|([A-Z]{1,2}\d{4}[A-Z]{2,3})/);
        if (pm) {
          // Look for timestamps nearby
          for (let tOff = pos; tOff < scan; tOff++) {
            const ts = readTimestamp(buf, tOff);
            if (ts) {
              const k = `${pm[0]}_${ts.toISOString()}`;
              if (!seen.has(k)) {
                seen.add(k);
                const ts2 = readTimestamp(buf, tOff + 4);
                records.push({
                  vrn: pm[0],
                  startDate: ts,
                  endDate: ts2,
                  nation: null,
                });
              }
              break;
            }
          }
          break;
        }
      }
    }
    
    pos += 31; // standard record size
  }
  
  // Sort by start date
  records.sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.getTime() - b.startDate.getTime();
  });
  
  return records;
}

// ====================================
// Main Parser Function
// ====================================

/**
 * Parse a TGD/DDD driver card file using the EU specification TLV structure.
 * This is the spec-based replacement for the heuristic parser.
 */
export function parseDriverCardSpec(buffer: Buffer, fileName: string): BinaryParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rawEvents: BinaryRawEvent[] = [];
  const metadata: BinaryParseResult['metadata'] = {};
  
  // Extract metadata from filename
  const cardInfo = extractCardInfoFromFilename(fileName);
  if (cardInfo.cardNumber) metadata.cardNumber = cardInfo.cardNumber;
  if (cardInfo.dni) metadata.driverDni = cardInfo.dni;
  
  // 1. Find all TLV blocks
  const tlvBlocks = findTLVBlocks(buffer);
  
  if (tlvBlocks.length === 0) {
    warnings.push('No TLV blocks found — file may not be a standard EU driver card format.');
    return {
      success: false,
      fileType: 'DRIVER_CARD',
      parserVersion: 'spec-v1',
      metadata,
      rawEvents: [],
      warnings,
      errors: ['No se encontraron bloques TLV válidos en el archivo.'],
    };
  }
  
  // 2. Parse EF_Driver_Activity_Data (0x0506)
  const activityBlocks = tlvBlocks.filter(b => b.tag === TAG_EF_DRIVER_ACTIVITY);
  let dailyRecords: DailyRecord[] = [];
  
  if (activityBlocks.length > 0) {
    // Use the largest block (in case there are signature blocks too)
    const mainBlock = activityBlocks.reduce((a, b) => a.length > b.length ? a : b);
    dailyRecords = parseDriverActivityData(buffer, mainBlock.offset, mainBlock.length);
    
    warnings.push(
      `Spec parser: ${dailyRecords.length} daily records from EF_Driver_Activity_Data ` +
      `(block @0x${(mainBlock.offset - mainBlock.headerSize).toString(16)}, ${mainBlock.length} bytes).`
    );
  } else {
    warnings.push('EF_Driver_Activity_Data (0x0506) not found in file.');
  }
  
  // 3. Parse EF_Vehicles_Used (0x0507)
  const vehicleBlocks = tlvBlocks.filter(b => b.tag === TAG_EF_VEHICLES_USED);
  let vehicleRecords: VehicleUsedRecord[] = [];
  
  if (vehicleBlocks.length > 0) {
    const mainBlock = vehicleBlocks.reduce((a, b) => a.length > b.length ? a : b);
    vehicleRecords = parseVehiclesUsed(buffer, mainBlock.offset, mainBlock.length);
    metadata.vehicleUsedRecords = vehicleRecords.map(vr => ({
      vrn: vr.vrn,
      startDate: vr.startDate,
      endDate: vr.endDate,
      odometerStart: null,
      odometerEnd: null,
    }));
    
    // Set primary plate from most-used vehicle
    if (vehicleRecords.length > 0) {
      const plateCounts = new Map<string, number>();
      for (const vr of vehicleRecords) {
        plateCounts.set(vr.vrn, (plateCounts.get(vr.vrn) || 0) + 1);
      }
      const primaryPlate = [...plateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (primaryPlate) {
        metadata.plateNumber = primaryPlate;
      }
    }
  }
  
  // 4. Convert daily records to BinaryRawEvent[]
  const rawDriverId = metadata.cardNumber || null;
  
  for (const day of dailyRecords) {
    // Find matching vehicle for this day
    let vehicleId: string | null = null;
    for (const vr of vehicleRecords) {
      const vrStart = vr.startDate ? vr.startDate.toISOString().substring(0, 10) : null;
      const vrEnd = vr.endDate ? vr.endDate.toISOString().substring(0, 10) : null;
      if (vrStart && vrEnd && day.dateStr >= vrStart && day.dateStr <= vrEnd) {
        vehicleId = vr.vrn;
        break;
      }
      if (vrStart && day.dateStr === vrStart) {
        vehicleId = vr.vrn;
        break;
      }
    }
    if (!vehicleId && metadata.plateNumber) {
      vehicleId = metadata.plateNumber;
    }
    
    // Convert activities to events (consecutive activity changes become events)
    for (let i = 0; i < day.activities.length; i++) {
      const act = day.activities[i];
      const nextAct = i + 1 < day.activities.length ? day.activities[i + 1] : null;
      
      const startTime = new Date(day.date.getTime() + act.minutes * 60000);
      const endMinutes = nextAct ? nextAct.minutes : 1440; // until next activity or end of day
      const endTime = new Date(day.date.getTime() + endMinutes * 60000);
      
      // Skip zero-duration events
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
        extractionNotes: `Spec: ${day.dateStr} ${act.activityType} ${act.minutes}m-${endMinutes}m (${durationMinutes}min)`,
        extractionStatus: 'OK',
      });
    }
  }
  
  // Sort all events
  rawEvents.sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
  
  // Set date range
  if (rawEvents.length > 0) {
    metadata.dateFrom = rawEvents[0].rawStartAt;
    metadata.dateTo = rawEvents[rawEvents.length - 1].rawEndAt;
  }
  
  // Summary
  const uniqueDays = new Set(dailyRecords.map(r => r.dateStr));
  warnings.push(
    `Spec parser: ${rawEvents.length} raw events from ${uniqueDays.size} days, ` +
    `${vehicleRecords.length} vehicle records.`
  );
  
  return {
    success: rawEvents.length > 0,
    fileType: 'DRIVER_CARD',
    parserVersion: 'spec-v1',
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
