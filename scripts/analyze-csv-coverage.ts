/**
 * Script para analizar el CSV del Ministerio de Transporte y extraer estadísticas
 * de cobertura: fechas únicas, actividades por día, matrículas usadas, etc.
 * 
 * Uso: npx ts-node scripts/analyze-csv-coverage.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.resolve(
  'C:\\Users\\Usuario.Usuario-PC\\Downloads\\C_E45802660T000001_E___20260316_1613.TGD_ACTIVIDADES.csv'
);

interface CsvRow {
  tarjeta: string;
  matricula: string;
  actividad: string; // DES, CON, TRA
  inicio: string;
  fin: string;
  estado: string;
  regimen: string;
}

function parseDate(dateStr: string): Date {
  // Format: DD/MM/YYYY HH:MM
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function getDateKey(dateStr: string): string {
  // Extract just YYYY-MM-DD from DD/MM/YYYY HH:MM
  const [datePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  
  // Skip header
  const header = lines[0];
  console.log('=== HEADER ===');
  console.log(header);
  console.log('');
  
  const rows: CsvRow[] = lines.slice(1).map(line => {
    const parts = line.split(';');
    return {
      tarjeta: parts[0],
      matricula: parts[1],
      actividad: parts[2],
      inicio: parts[3],
      fin: parts[4],
      estado: parts[5],
      regimen: parts[6],
    };
  });
  
  console.log(`Total filas de actividad: ${rows.length}`);
  console.log('');
  
  // Unique dates
  const dateMap = new Map<string, {
    count: number;
    matriculas: Set<string>;
    actividades: { DES: number; CON: number; TRA: number };
    firstStart: string;
    lastEnd: string;
  }>();
  
  for (const row of rows) {
    const dateKey = getDateKey(row.inicio);
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        count: 0,
        matriculas: new Set(),
        actividades: { DES: 0, CON: 0, TRA: 0 },
        firstStart: row.inicio,
        lastEnd: row.fin,
      });
    }
    const entry = dateMap.get(dateKey)!;
    entry.count++;
    entry.matriculas.add(row.matricula);
    if (row.actividad === 'DES') entry.actividades.DES++;
    else if (row.actividad === 'CON') entry.actividades.CON++;
    else if (row.actividad === 'TRA') entry.actividades.TRA++;
    entry.lastEnd = row.fin;
  }
  
  // Sort by date
  const sortedDates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  
  console.log('=== DÍAS CON ACTIVIDAD ===');
  console.log(`Total días únicos: ${sortedDates.length}`);
  console.log('');
  console.log('Fecha       | Filas | Matrículas              | DES | CON | TRA | Primera  | Última');
  console.log('------------|-------|-------------------------|-----|-----|-----|----------|--------');
  
  for (const [dateKey, data] of sortedDates) {
    const mats = [...data.matriculas].join(',');
    const firstTime = data.firstStart.split(' ')[1];
    const lastTime = data.lastEnd.split(' ')[1];
    console.log(
      `${dateKey} | ${String(data.count).padStart(5)} | ${mats.padEnd(23)} | ${String(data.actividades.DES).padStart(3)} | ${String(data.actividades.CON).padStart(3)} | ${String(data.actividades.TRA).padStart(3)} | ${firstTime}    | ${lastTime}`
    );
  }
  
  // Unique matrículas
  const allMatriculas = new Set<string>();
  for (const row of rows) allMatriculas.add(row.matricula);
  
  console.log('');
  console.log('=== MATRÍCULAS ÚNICAS ===');
  for (const mat of allMatriculas) {
    const count = rows.filter(r => r.matricula === mat).length;
    console.log(`  ${mat}: ${count} actividades`);
  }
  
  // Activity type distribution
  const actCounts = { DES: 0, CON: 0, TRA: 0 };
  for (const row of rows) {
    if (row.actividad === 'DES') actCounts.DES++;
    else if (row.actividad === 'CON') actCounts.CON++;
    else if (row.actividad === 'TRA') actCounts.TRA++;
  }
  
  console.log('');
  console.log('=== DISTRIBUCIÓN DE ACTIVIDADES ===');
  console.log(`  DES (Descanso): ${actCounts.DES}`);
  console.log(`  CON (Conducción): ${actCounts.CON}`);
  console.log(`  TRA (Trabajo): ${actCounts.TRA}`);
  
  // Map activity codes to our types
  console.log('');
  console.log('=== MAPEO DE CÓDIGOS ===');
  console.log('  CSV -> Sistema:');
  console.log('  DES (Descanso)    -> REST');
  console.log('  CON (Conducción)  -> DRIVING');
  console.log('  TRA (Trabajo)     -> OTHER_WORK');
  
  // Find gaps > 1 day
  console.log('');
  console.log('=== HUECOS DE DATOS (>1 día) ===');
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1][0]);
    const currDate = new Date(sortedDates[i][0]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      console.log(`  ${sortedDates[i - 1][0]} → ${sortedDates[i][0]} : ${diffDays} días (hueco de ${diffDays - 1} días sin actividad)`);
    }
  }
}

main();
