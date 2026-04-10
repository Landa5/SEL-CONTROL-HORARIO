/**
 * Script de verificación: parsea los TGD binarios y compara con los CSV de referencia.
 * Ejecutar: npx tsx scripts/verify-parser.ts
 */

import fs from 'fs';
import path from 'path';
import { parseBinaryTachograph } from '../lib/tacografo/tachograph-binary-parser.js';

const ACTIVITY_MAP: Record<string, string> = {
  'DES': 'REST', 'CON': 'DRIVING', 'TRA': 'OTHER_WORK', 'DIS': 'AVAILABILITY',
};

function parseCSVDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(parseInt(match[3]), parseInt(match[2])-1, parseInt(match[1]), parseInt(match[4]), parseInt(match[5]), 0));
}

function fmt(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth()+1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

interface CsvRow { tarjeta: string; matricula: string; actividad: string; inicio: string; fin: string; estado: string; regimen: string; }

function parseCSVFile(csvPath: string): CsvRow[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 5) continue;
    rows.push({
      tarjeta: parts[0]?.trim() || '', matricula: parts[1]?.trim() || '',
      actividad: parts[2]?.trim() || '', inicio: parts[3]?.trim() || '',
      fin: parts[4]?.trim() || '', estado: parts[5]?.trim() || '', regimen: parts[6]?.trim() || '',
    });
  }
  return rows;
}

const out: string[] = [];
const log = (s: string) => out.push(s);

function compare(tgdPath: string, csvPath: string) {
  const fileName = path.basename(tgdPath);
  log('='.repeat(80));
  log(`FICHERO: ${fileName}`);
  log('='.repeat(80));

  const buffer = fs.readFileSync(tgdPath);
  const result = parseBinaryTachograph(buffer, fileName);

  log(`\nMETADATA:`);
  log(`  fileType:     ${result.fileType}`);
  log(`  plateNumber:  ${result.metadata.plateNumber || 'N/A'}`);
  log(`  cardNumber:   ${result.metadata.cardNumber || 'N/A'}`);
  log(`  driverName:   ${result.metadata.driverName || 'N/A'}`);
  log(`  rawEvents:    ${result.rawEvents.length}`);

  if (result.warnings.length > 0) {
    log(`\nWARNINGS:`);
    for (const w of result.warnings.slice(0, 5)) log(`  ${w}`);
  }

  const csvRows = parseCSVFile(csvPath);
  log(`\nCSV referencia: ${csvRows.length} filas`);

  const sorted = [...result.rawEvents].sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
  
  log(`\nPARSER EVENTS (${sorted.length}):`);
  for (const e of sorted) {
    const plate = e.rawVehicleIdentifier || '???';
    const driver = e.rawDriverIdentifier || '---';
    const dur = Math.round((e.rawEndAt.getTime() - e.rawStartAt.getTime()) / 60000);
    log(`  ${fmt(e.rawStartAt)} - ${fmt(e.rawEndAt)}  [${String(dur).padStart(4)}m]  ${e.rawActivityType.padEnd(14)} VEH:${plate} COND:${driver}`);
  }

  log(`\nCSV ROWS (${csvRows.length}):`);
  for (const row of csvRows) {
    const act = ACTIVITY_MAP[row.actividad.toUpperCase()] || row.actividad;
    const start = parseCSVDate(row.inicio);
    const end = parseCSVDate(row.fin);
    const dur = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0;
    log(`  ${row.inicio.padEnd(16)} - ${row.fin.padEnd(16)}  [${String(dur).padStart(4)}m]  ${act.padEnd(14)} VEH:${row.matricula} COND:${row.tarjeta || '---'}`);
  }

  // Per-day comparison
  log(`\nCOMPARACION POR DIA:`);
  
  const parserByDay = new Map<string, Map<string, number>>();
  for (const e of sorted) {
    const dayStr = e.rawStartAt.toISOString().substring(0, 10);
    if (!parserByDay.has(dayStr)) parserByDay.set(dayStr, new Map());
    const dayMap = parserByDay.get(dayStr)!;
    const dur = Math.round((e.rawEndAt.getTime() - e.rawStartAt.getTime()) / 60000);
    dayMap.set(e.rawActivityType, (dayMap.get(e.rawActivityType) || 0) + dur);
  }
  
  const csvByDay = new Map<string, Map<string, number>>();
  for (const row of csvRows) {
    const start = parseCSVDate(row.inicio);
    const end = parseCSVDate(row.fin);
    if (!start || !end) continue;
    const dayStr = start.toISOString().substring(0, 10);
    if (!csvByDay.has(dayStr)) csvByDay.set(dayStr, new Map());
    const dayMap = csvByDay.get(dayStr)!;
    const act = ACTIVITY_MAP[row.actividad.toUpperCase()] || row.actividad;
    const dur = Math.round((end.getTime() - start.getTime()) / 60000);
    dayMap.set(act, (dayMap.get(act) || 0) + dur);
  }
  
  const allDays = [...new Set([...parserByDay.keys(), ...csvByDay.keys()])].sort();
  
  for (const day of allDays) {
    const pDay = parserByDay.get(day) || new Map();
    const cDay = csvByDay.get(day) || new Map();
    const allActs = [...new Set([...pDay.keys(), ...cDay.keys()])].sort();
    
    log(`\n  ${day}:`);
    for (const act of allActs) {
      const pMin = pDay.get(act) || 0;
      const cMin = cDay.get(act) || 0;
      const diff = pMin - cMin;
      const icon = Math.abs(diff) <= 5 ? 'OK' : 'DIFF';
      log(`    [${icon}] ${act.padEnd(14)} Parser:${String(pMin).padStart(5)}m  CSV:${String(cMin).padStart(5)}m  Diff:${diff > 0 ? '+' : ''}${diff}m`);
    }
  }

  log(`\n  Matricula parser: ${result.metadata.plateNumber || 'N/A'}`);
  const csvPlates = [...new Set(csvRows.map(r => r.matricula).filter(m => m && !m.includes('?')))];
  log(`  Matriculas CSV:   ${csvPlates.join(', ')}`);
}

log('=== VERIFICACION PARSER BINARIO vs CSV REFERENCIA ===\n');

const vehicleTGD = 'C:\\tacografo\\2026\\TACHO\\V_______1713FHR_E___20260316_1725.TGD';
const vehicleCSV = 'C:\\Users\\Usuario.Usuario-PC\\Downloads\\V_______1713FHR_E___20260316_1725.TGD_ACTIVIDADES (1).csv';
const driverTGD = 'C:\\tacografo\\2026\\CARD\\C_E29028003W000003_E___20260317_1040.TGD';
const driverCSV = 'C:\\Users\\Usuario.Usuario-PC\\Downloads\\C_E29028003W000003_E___20260317_1040.TGD_ACTIVIDADES.csv';

if (fs.existsSync(vehicleTGD) && fs.existsSync(vehicleCSV)) {
  compare(vehicleTGD, vehicleCSV);
} else {
  log('Vehiculo TGD/CSV no encontrado');
  if (!fs.existsSync(vehicleTGD)) log(`  TGD: ${vehicleTGD}`);
  if (!fs.existsSync(vehicleCSV)) log(`  CSV: ${vehicleCSV}`);
}

log('\n\n');

if (fs.existsSync(driverTGD) && fs.existsSync(driverCSV)) {
  compare(driverTGD, driverCSV);
} else {
  log('Conductor TGD/CSV no encontrado');
  if (!fs.existsSync(driverTGD)) log(`  TGD: ${driverTGD}`);
  if (!fs.existsSync(driverCSV)) log(`  CSV: ${driverCSV}`);
}

const outFile = path.resolve('scripts', 'verify-result.txt');
fs.writeFileSync(outFile, out.join('\n'), 'utf-8');
console.log('Done: ' + outFile);
