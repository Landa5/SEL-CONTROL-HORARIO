/**
 * Script para analizar la estructura TLV de un archivo TGD de tarjeta de conductor.
 * Busca los File IDs de la spec EU 2016/799: 
 *   0x0002 - IC (Card ICC)
 *   0x0005 - Card Certificate
 *   0x0501 - ID data 
 *   0x0502 - Card Download
 *   0x0503 - Driving Licence Info
 *   0x0504 - Events Data
 *   0x0505 - Faults Data
 *   0x0506 - Driver Activity Data  <-- THIS IS THE KEY ONE
 *   0x0507 - Vehicles Used
 *   0x0508 - Places
 *   0x050B - Control Activity Data
 *   0x050C - Specific Conditions
 * 
 * Also scans for the TREP tag pattern used in some TGD file wrappers.
 */

import * as fs from 'fs';
import * as path from 'path';

const FILE_PATH = path.resolve(
  'C:\\Users\\Usuario.Usuario-PC\\Downloads\\C_E45802660T000001_E___20260316_1613.TGD'
);

function readUint16BE(buf: Buffer, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

function readUint32BE(buf: Buffer, offset: number): number {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function hexDump(buf: Buffer, offset: number, length: number): string {
  const bytes = buf.subarray(offset, Math.min(offset + length, buf.length));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

// EU 2016/799 known tags for driver card
const KNOWN_TAGS: Record<number, string> = {
  0x0002: 'Card_ICC',
  0x0005: 'Card_Certificate_CA',  
  0xC100: 'Card_Certificate',
  0xC101: 'Card_MA_Certificate',
  0x0501: 'EF_Identification',
  0x0502: 'EF_Card_Download',
  0x0503: 'EF_Driving_Licence_Info',
  0x0504: 'EF_Events_Data',
  0x0505: 'EF_Faults_Data',
  0x0506: 'EF_Driver_Activity_Data',  // <-- KEY
  0x0507: 'EF_Vehicles_Used',
  0x0508: 'EF_Places',
  0x050B: 'EF_Control_Activity_Data',
  0x050C: 'EF_Specific_Conditions',
  0x0520: 'EF_VU_Configuration',
  0x0521: 'EF_VU_Overview',
  0x0522: 'EF_VU_Activities',
  0x0523: 'EF_VU_Events_Faults',
  0x0524: 'EF_VU_Detailed_Speed',
  0x0525: 'EF_VU_Technical_Data',
  // TREP wrapper tags
  0x7600: 'TREP_Tag_7600',
  0x7601: 'TREP_Tag_7601',
  0x7602: 'TREP_Tag_7602',
  0x7603: 'TREP_Tag_7603',
  0x7604: 'TREP_Tag_7604',
  0x7605: 'TREP_Tag_7605',
  0x7606: 'TREP_Tag_7606',
  0x7607: 'TREP_Tag_7607',
};

function main() {
  const buf = fs.readFileSync(FILE_PATH);
  console.log(`File: ${path.basename(FILE_PATH)}`);
  console.log(`Size: ${buf.length} bytes (${(buf.length / 1024).toFixed(1)} KB)`);
  console.log('');
  
  // 1. First 100 bytes hex dump
  console.log('=== FIRST 100 BYTES ===');
  for (let i = 0; i < Math.min(100, buf.length); i += 16) {
    const hex = hexDump(buf, i, 16);
    const ascii = Array.from(buf.subarray(i, Math.min(i + 16, buf.length)))
      .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.')
      .join('');
    console.log(`${i.toString(16).padStart(6, '0')}: ${hex.padEnd(48)} ${ascii}`);
  }
  console.log('');
  
  // 2. Scan for known TLV tags
  console.log('=== TLV TAG SCAN ===');
  const foundTags: { offset: number; tag: number; tagName: string; length: number }[] = [];
  
  for (let i = 0; i < buf.length - 4; i++) {
    const tag = readUint16BE(buf, i);
    if (KNOWN_TAGS[tag]) {
      // Determine length encoding
      // TLV length can be 1, 2, or 3 bytes depending on first byte
      let dataLength = 0;
      let headerSize = 2; // tag is always 2 bytes
      
      const lenByte1 = buf[i + 2];
      if (lenByte1 <= 0x7f) {
        // Short form: length is 1 byte
        dataLength = lenByte1;
        headerSize += 1;
      } else if (lenByte1 === 0x81) {
        // 2-byte length
        dataLength = buf[i + 3];
        headerSize += 2;
      } else if (lenByte1 === 0x82) {
        // 3-byte length
        dataLength = readUint16BE(buf, i + 3);
        headerSize += 3;
      }
      
      // Sanity check: length should not exceed file size
      if (dataLength > 0 && dataLength < buf.length && (i + headerSize + dataLength) <= buf.length) {
        foundTags.push({
          offset: i,
          tag,
          tagName: KNOWN_TAGS[tag],
          length: dataLength,
        });
        
        console.log(
          `  @0x${i.toString(16).padStart(6, '0')} | Tag: 0x${tag.toString(16).padStart(4, '0')} | ` +
          `${KNOWN_TAGS[tag].padEnd(30)} | Length: ${dataLength} bytes (hdr: ${headerSize})`
        );
        
        // If this is EF_Driver_Activity_Data, dump the first 100 bytes of content
        if (tag === 0x0506 && dataLength > 0) {
          const contentStart = i + headerSize;
          console.log(`    CONTENT START (first 100 bytes):`);
          for (let j = 0; j < Math.min(100, dataLength); j += 16) {
            const hex = hexDump(buf, contentStart + j, 16);
            console.log(`      ${(contentStart + j).toString(16).padStart(6, '0')}: ${hex}`);
          }
          
          // Parse the CardActivityDailyRecord structure
          parseDriverActivityData(buf, contentStart, dataLength);
        }
        
        // For EF_Vehicles_Used, also peek at content
        if (tag === 0x0507 && dataLength > 0) {
          const contentStart = i + headerSize;
          console.log(`    CONTENT START (first 80 bytes):`);
          for (let j = 0; j < Math.min(80, dataLength); j += 16) {
            const hex = hexDump(buf, contentStart + j, 16);
            console.log(`      ${(contentStart + j).toString(16).padStart(6, '0')}: ${hex}`);
          }
        }
      }
    }
  }
  
  console.log(`\nTotal known tags found: ${foundTags.length}`);
  
  // 3. Also scan with single-byte tags (some formats use 1-byte tags)
  console.log('\n=== ALTERNATIVE: SCANNING FOR BYTE PATTERNS ===');
  
  // Look for sequences of 4-byte timestamps aligned to midnight (these are day record dates)
  const SECONDS_PER_DAY = 86400;
  let midnightCount = 0;
  const midnightPositions: { offset: number; date: Date; }[] = [];
  
  for (let i = 0; i < buf.length - 3; i++) {
    const ts = readUint32BE(buf, i);
    if (ts >= 1577836800 && ts <= 1900000000 && ts % SECONDS_PER_DAY === 0) { // 2020-2030
      const date = new Date(ts * 1000);
      midnightPositions.push({ offset: i, date });
      midnightCount++;
    }
  }
  
  console.log(`Midnight-aligned timestamps found: ${midnightCount}`);
  if (midnightPositions.length > 0) {
    // Group by unique date
    const dateGroups = new Map<string, typeof midnightPositions>();
    for (const mp of midnightPositions) {
      const key = mp.date.toISOString().substring(0, 10);
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(mp);
    }
    
    console.log(`Unique dates: ${dateGroups.size}`);
    for (const [dateStr, positions] of [...dateGroups.entries()].sort()) {
      const offsets = positions.map(p => `0x${p.offset.toString(16)}`).join(', ');
      console.log(`  ${dateStr}: ${positions.length} occurrence(s) at [${offsets}]`);
    }
  }
}

/**
 * Parse CardDriverActivity structure per EU 2016/799 spec:
 * 
 * CardDriverActivity ::= SEQUENCE {
 *   activityPointerOldestDayRecord  INTEGER(2 bytes),
 *   activityPointerNewestRecord    INTEGER(2 bytes),
 *   activityDailyRecords           SET OF CardActivityDailyRecord
 * }
 * 
 * Where each CardActivityDailyRecord = {
 *   activityRecordLength    INTEGER(2 bytes),
 *   activityRecordDate      TimeReal(4 bytes) — midnight timestamp
 *   activityDailyPresenceCounter  OCTET STRING(2 bytes)
 *   activityDayDistance      INTEGER(2 bytes)
 *   activityChangeInfo       SET OF ActivityChangeInfo(2 bytes each)
 * }
 */
function parseDriverActivityData(buf: Buffer, offset: number, totalLength: number) {
  console.log(`\n    === PARSING EF_Driver_Activity_Data ===`);
  
  // First 4 bytes: pointers
  const oldestDayPtr = readUint16BE(buf, offset);
  const newestRecPtr = readUint16BE(buf, offset + 2);
  console.log(`    oldestDayRecordPointer: ${oldestDayPtr}`);
  console.log(`    newestRecordPointer: ${newestRecPtr}`);
  console.log(`    Data area size: ${totalLength - 4} bytes`);
  
  const dataStart = offset + 4;
  const dataEnd = offset + totalLength;
  
  // The activity daily records are in a cyclical buffer starting at dataStart
  // oldestDayPtr and newestRecPtr are offsets within the data area (relative to dataStart)
  
  // Attempt to parse daily records starting from oldestDayPtr
  let pos = dataStart + oldestDayPtr;
  let dailyCount = 0;
  let totalActivities = 0;
  
  console.log(`\n    Parsing daily records from offset 0x${pos.toString(16)}:`);
  console.log(`    ${'Date'.padEnd(12)} | Len | Distance | Activities | First few activity types`);
  console.log(`    ${''.padEnd(12, '-')}|-----|----------|------------|-------------------------`);
  
  // Parse until we've wrapped around back to the start or hit limit
  const visited = new Set<number>();
  let maxRecords = 200; // safety limit
  
  while (maxRecords-- > 0) {
    if (pos >= dataEnd) {
      // Wrap around to start of data area
      pos = dataStart + ((pos - dataStart) % (dataEnd - dataStart));
    }
    
    if (visited.has(pos)) break;
    visited.add(pos);
    
    if (pos + 10 > dataEnd) break;
    
    // Read record header
    const recordLength = readUint16BE(buf, pos);
    if (recordLength < 10 || recordLength > 2000) {
      // Invalid record length — try if this is zeros (empty space)
      if (recordLength === 0) {
        // Skip to next potential record
        pos += 2;
        continue;
      }
      console.log(`    [STOP] Invalid record length: ${recordLength} at 0x${pos.toString(16)}`);
      break;
    }
    
    const recordDate = readUint32BE(buf, pos + 2);
    const dailyPresenceCounter = readUint16BE(buf, pos + 6);
    const dayDistance = readUint16BE(buf, pos + 8);
    
    // Validate date
    if (recordDate === 0 || recordDate === 0xffffffff) {
      pos += recordLength;
      continue;
    }
    
    const date = new Date(recordDate * 1000);
    const dateStr = date.toISOString().substring(0, 10);
    
    // Parse activity change records (2 bytes each, starting at pos+10)
    const activityStart = pos + 10;
    const activityEnd = pos + recordLength;
    const activityCount = Math.floor((activityEnd - activityStart) / 2);
    
    // Read first few activities
    const ACT_NAMES: Record<number, string> = { 0: 'REST', 1: 'AVAIL', 2: 'WORK', 3: 'DRIVE' };
    const firstActivities: string[] = [];
    for (let a = 0; a < Math.min(activityCount, 5); a++) {
      const actBytes = readUint16BE(buf, activityStart + a * 2);
      const actCode = (actBytes >> 11) & 0x03;
      const minutes = actBytes & 0x07ff;
      firstActivities.push(`${ACT_NAMES[actCode] || '??'}@${minutes}m`);
    }
    
    dailyCount++;
    totalActivities += activityCount;
    
    console.log(
      `    ${dateStr.padEnd(12)} | ${String(recordLength).padStart(3)} | ${String(dayDistance).padStart(8)} | ${String(activityCount).padStart(10)} | ${firstActivities.join(', ')}`
    );
    
    pos += recordLength;
    
    // Check if we've reached the newest record
    if (pos >= dataStart + newestRecPtr + 2 && newestRecPtr > oldestDayPtr) {
      // We may have read past the newest record
      // But let's keep going to get all data
    }
  }
  
  console.log(`\n    Total daily records parsed: ${dailyCount}`);
  console.log(`    Total activity changes: ${totalActivities}`);
}

main();
