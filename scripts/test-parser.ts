/**
 * Script de diagnóstico para ver TODOS los datos que extrae el parser de un archivo de tacógrafo.
 * 
 * Uso: npx tsx scripts/test-parser.ts <ruta-al-archivo.TGD>
 * 
 * Ejemplo: npx tsx scripts/test-parser.ts "C:\Users\Usuario.Usuario-PC\Downloads\archivo.TGD"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Importar el parser
// Simular las funciones del parser inline para evitar dependencias de módulo
const ACTIVITY_CODES: Record<number, string> = {
  0: 'REST',
  1: 'AVAILABILITY',
  2: 'OTHER_WORK',
  3: 'DRIVING',
};

function readUint16BE(buf: Buffer, offset: number): number {
  if (offset + 1 >= buf.length) return 0;
  return (buf[offset] << 8) | buf[offset + 1];
}

function readUint32BE(buf: Buffer, offset: number): number {
  if (offset + 3 >= buf.length) return 0;
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function extractDateFromFileName(name: string): Date | null {
  const match = name.match(/(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (match) {
    const d = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2040) return d;
  }
  return null;
}

// ============================================================================
// MAIN
// ============================================================================

const filePath = process.argv[2];
if (!filePath) {
  console.log('❌ Uso: npx tsx scripts/test-parser.ts <ruta-al-archivo.TGD>');
  console.log('');
  console.log('Ejemplo: npx tsx scripts/test-parser.ts "C:\\Users\\Downloads\\archivo.TGD"');
  process.exit(1);
}

const absolutePath = resolve(filePath);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO DE ARCHIVO DE TACÓGRAFO');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

let buf: Buffer;
try {
  buf = readFileSync(absolutePath);
} catch (err: any) {
  console.log(`❌ No se puede leer el archivo: ${err.message}`);
  process.exit(1);
}

const fileName = absolutePath.split(/[\\/]/).pop() || '';

console.log(`📁 Archivo: ${fileName}`);
console.log(`📏 Tamaño: ${buf.length} bytes (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`📅 Fecha del nombre: ${extractDateFromFileName(fileName)?.toISOString().substring(0, 10) || 'No detectada'}`);

// Detectar tipo
const ext = fileName.split('.').pop()?.toLowerCase() || '';
const baseName = fileName.toUpperCase();
let fileType = 'UNKNOWN';
if (['esm', 'v1b'].includes(ext)) fileType = 'VEHICLE_UNIT';
else if (['c1b', 'tgd'].includes(ext)) fileType = 'DRIVER_CARD';
else if (baseName.startsWith('C_')) fileType = 'DRIVER_CARD';
else if (baseName.startsWith('V_') || baseName.startsWith('S_') || baseName.startsWith('M_')) fileType = 'VEHICLE_UNIT';

console.log(`🏷️  Tipo: ${fileType}`);
console.log('');

// ============================================================================
// 1. BUSCAR TODOS LOS TIMESTAMPS DE MEDIANOCHE
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('  1. TIMESTAMPS DE MEDIANOCHE ENCONTRADOS');
console.log('     (divisible por 86400 = inicio de día UTC)');
console.log('═══════════════════════════════════════════════════════════════');

const fileDate = extractDateFromFileName(fileName);
const refDate = fileDate || new Date();
const maxYearsBack = fileType === 'DRIVER_CARD' ? 2 : 1;
const minTs = Math.floor((refDate.getTime() - maxYearsBack * 365.25 * 24 * 60 * 60 * 1000) / 1000);
const maxTs = Math.floor((refDate.getTime() + 7 * 24 * 60 * 60 * 1000) / 1000);

console.log(`  Rango de búsqueda: ${new Date(minTs * 1000).toISOString().substring(0, 10)} → ${new Date(maxTs * 1000).toISOString().substring(0, 10)}`);
console.log('');

const SECONDS_PER_DAY = 86400;
interface TsInfo {
  offset: number;
  ts: number;
  date: Date;
  isMidnight: boolean;
}

const allTimestamps: TsInfo[] = [];
for (let i = 0; i < buf.length - 3; i++) {
  const ts = readUint32BE(buf, i);
  if (ts >= minTs && ts <= maxTs) {
    const isMidnight = ts % SECONDS_PER_DAY === 0;
    allTimestamps.push({
      offset: i,
      ts,
      date: new Date(ts * 1000),
      isMidnight,
    });
  }
}

// Deduplicar por offset cercano (evitar solapamientos de 1-3 bytes)
const dedupTimestamps: TsInfo[] = [];
for (const t of allTimestamps) {
  if (dedupTimestamps.length === 0 || t.offset - dedupTimestamps[dedupTimestamps.length - 1].offset >= 4) {
    dedupTimestamps.push(t);
  }
}

const midnightTs = dedupTimestamps.filter(t => t.isMidnight);
const nonMidnightTs = dedupTimestamps.filter(t => !t.isMidnight);

console.log(`  Total timestamps en rango: ${dedupTimestamps.length}`);
console.log(`  ├── Alineados a medianoche: ${midnightTs.length}`);
console.log(`  └── No alineados: ${nonMidnightTs.length}`);
console.log('');

if (midnightTs.length > 0) {
  console.log('  Timestamps de medianoche:');
  for (const t of midnightTs) {
    console.log(`    offset=${t.offset.toString().padStart(6)}, ${t.date.toISOString().substring(0, 10)} (ts=${t.ts})`);
  }
} else {
  console.log('  ⚠️  No se encontraron timestamps de medianoche en el rango.');
}

if (nonMidnightTs.length > 0 && nonMidnightTs.length <= 50) {
  console.log('');
  console.log('  Timestamps no-medianoche (primeros 20):');
  for (const t of nonMidnightTs.slice(0, 20)) {
    console.log(`    offset=${t.offset.toString().padStart(6)}, ${t.date.toISOString()} (ts=${t.ts})`);
  }
}

// ============================================================================
// 2. INTENTAR PARSEAR ACTIVIDADES DESPUÉS DE CADA TIMESTAMP DE MEDIANOCHE
// ============================================================================
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  2. ACTIVIDADES PARSEADAS POR DÍA');
console.log('═══════════════════════════════════════════════════════════════');

const timestampsToTry = midnightTs.length > 0 ? midnightTs : nonMidnightTs.slice(0, 30);

for (const tsInfo of timestampsToTry) {
  const dayStart = new Date(Date.UTC(
    tsInfo.date.getUTCFullYear(), tsInfo.date.getUTCMonth(), tsInfo.date.getUTCDate(), 0, 0, 0
  ));
  
  console.log('');
  console.log(`  📅 DÍA: ${dayStart.toISOString().substring(0, 10)} (offset=${tsInfo.offset})`);
  
  // Intentar parsear activity records
  const offset = tsInfo.offset + 4;
  let prevMinutes = -1;
  let validCount = 0;
  let invalidCount = 0;
  const records: { minutes: number; activityType: string; slot: number; cardInserted: boolean; raw: string }[] = [];
  
  for (let j = 0; j < 200; j++) {
    const pos = offset + (j * 2);
    if (pos + 1 >= buf.length) break;
    
    const record = readUint16BE(buf, pos);
    if (record === 0 || record === 0xffff) {
      if (validCount > 0) {
        records.push({ minutes: -1, activityType: record === 0 ? 'END(0x0000)' : 'END(0xFFFF)', slot: 0, cardInserted: false, raw: `0x${record.toString(16).padStart(4, '0')}` });
        break;
      }
      continue;
    }
    
    const slot = (record >> 15) & 1;
    const cardInserted = ((record >> 13) & 1) === 1;
    const activityCode = (record >> 11) & 0x03;
    const minutes = record & 0x07ff;
    const activityType = ACTIVITY_CODES[activityCode] || 'UNKNOWN';
    
    if (minutes > 1440) {
      invalidCount++;
      if (invalidCount >= 3) {
        records.push({ minutes, activityType: 'INVALID(>1440)', slot, cardInserted, raw: `0x${record.toString(16).padStart(4, '0')}` });
        break;
      }
      continue;
    }
    
    if (prevMinutes >= 0 && minutes < prevMinutes) {
      invalidCount++;
      if (invalidCount >= 3) break;
      continue;
    }
    
    validCount++;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    records.push({
      minutes,
      activityType,
      slot,
      cardInserted,
      raw: `0x${record.toString(16).padStart(4, '0')} → ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} slot=${slot} card=${cardInserted ? 'sí' : 'no'} ${activityType}`,
    });
    
    prevMinutes = minutes;
  }
  
  if (validCount >= 2) {
    console.log(`  ✅ ${validCount} registros válidos, ${invalidCount} inválidos:`);
    for (const r of records) {
      console.log(`     ${r.raw}`);
    }
    
    // Mostrar resumen de actividades del día
    console.log('');
    console.log('     Resumen del día:');
    for (let i = 0; i < records.length - 1; i++) {
      const curr = records[i];
      const next = records[i + 1];
      if (curr.minutes >= 0 && next.minutes >= 0 && next.minutes > curr.minutes) {
        const dur = next.minutes - curr.minutes;
        const hStart = Math.floor(curr.minutes / 60);
        const mStart = curr.minutes % 60;
        const hEnd = Math.floor(next.minutes / 60);
        const mEnd = next.minutes % 60;
        console.log(`     ${hStart.toString().padStart(2, '0')}:${mStart.toString().padStart(2, '0')} - ${hEnd.toString().padStart(2, '0')}:${mEnd.toString().padStart(2, '0')} → ${curr.activityType.padEnd(14)} (${dur} min)`);
      }
    }
  } else if (validCount > 0) {
    console.log(`  ⚠️  Solo ${validCount} registro(s) válido(s) — insuficiente`);
  } else {
    console.log(`  ❌ No se encontraron activity records válidos`);
  }
}

// ============================================================================
// 3. BUSCAR CADENAS ASCII LEGIBLES (cardNumber, VRN, nombres)
// ============================================================================
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  3. CADENAS ASCII LEGIBLES ENCONTRADAS');
console.log('═══════════════════════════════════════════════════════════════');

// Buscar cadenas de 6+ caracteres ASCII imprimibles
const strings: { offset: number; text: string }[] = [];
let currentString = '';
let stringStart = 0;

for (let i = 0; i < buf.length; i++) {
  const b = buf[i];
  if (b >= 0x20 && b <= 0x7e) {
    if (currentString.length === 0) stringStart = i;
    currentString += String.fromCharCode(b);
  } else {
    if (currentString.length >= 6) {
      strings.push({ offset: stringStart, text: currentString });
    }
    currentString = '';
  }
}
if (currentString.length >= 6) {
  strings.push({ offset: stringStart, text: currentString });
}

// Mostrar las más relevantes
const relevantStrings = strings.filter(s =>
  /[A-Z]{2,}/.test(s.text) || // Contiene mayúsculas
  /\d{4,}/.test(s.text) ||    // Contiene números
  s.text.length >= 8            // Suficientemente larga
);

console.log(`  Total cadenas (>= 6 chars): ${strings.length}`);
console.log(`  Relevantes: ${relevantStrings.length}`);
console.log('');

for (const s of relevantStrings.slice(0, 40)) {
  console.log(`  offset=${s.offset.toString().padStart(6)}: "${s.text}"`);
}

// ============================================================================
// 4. HEXDUMP DE PRIMEROS BYTES Y ALREDEDOR DE TIMESTAMPS
// ============================================================================
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  4. HEXDUMP PRIMEROS 128 BYTES');
console.log('═══════════════════════════════════════════════════════════════');

for (let row = 0; row < 8; row++) {
  const start = row * 16;
  const hex = Array.from(buf.subarray(start, start + 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  const ascii = Array.from(buf.subarray(start, start + 16))
    .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.')
    .join('');
  console.log(`  ${start.toString(16).padStart(6, '0')}: ${hex}  ${ascii}`);
}

// ============================================================================
// 5. RESUMEN FINAL
// ============================================================================
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  5. RESUMEN FINAL');
console.log('═══════════════════════════════════════════════════════════════');

const daysWithActivities = timestampsToTry.filter(t => {
  const offset = t.offset + 4;
  let valid = 0;
  let prevMin = -1;
  for (let j = 0; j < 200; j++) {
    const pos = offset + (j * 2);
    if (pos + 1 >= buf.length) break;
    const record = readUint16BE(buf, pos);
    if (record === 0 || record === 0xffff) { if (valid > 0) break; continue; }
    const minutes = record & 0x07ff;
    if (minutes > 1440) break;
    if (prevMin >= 0 && minutes < prevMin) break;
    valid++;
    prevMin = minutes;
  }
  return valid >= 3;
}).length;

console.log(`  Tipo archivo: ${fileType}`);
console.log(`  Tamaño: ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  Fecha del nombre: ${fileDate?.toISOString().substring(0, 10) || 'No detectada'}`);
console.log(`  Timestamps medianoche: ${midnightTs.length}`);
console.log(`  Timestamps no-medianoche: ${nonMidnightTs.length}`);
console.log(`  Días con actividades válidas: ${daysWithActivities}`);
console.log(`  Cadenas ASCII relevantes: ${relevantStrings.length}`);
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
