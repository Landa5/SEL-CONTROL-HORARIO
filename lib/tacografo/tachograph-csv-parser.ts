/**
 * TachographCSVParser — Parser del formato CSV del Ministerio de Transporte
 * 
 * Parsea el CSV que genera el Ministerio al leer archivos TGD/DDD de tarjeta de conductor.
 * Formato: TARJETA;MATRICULA;ACTIVIDAD;INICIO;FIN;ESTADO;REGIMEN
 * 
 * Produce BinaryRawEvent[] compatibles con el pipeline existente.
 * 
 * Mapeo de actividades:
 *   DES → REST
 *   CON → DRIVING
 *   TRA → OTHER_WORK
 *   DIS → AVAILABILITY
 */

import type { BinaryRawEvent, BinaryParseResult } from './tachograph-binary-parser';

// ====================================
// Constantes
// ====================================

const ACTIVITY_MAP: Record<string, string> = {
  'DES': 'REST',
  'CON': 'DRIVING',
  'TRA': 'OTHER_WORK',
  'DIS': 'AVAILABILITY',
};

const EXPECTED_HEADERS = ['TARJETA', 'MATRICULA', 'ACTIVIDAD', 'INICIO', 'FIN', 'ESTADO', 'REGIMEN'];

// ====================================
// Interfaces
// ====================================

interface CsvActivityRow {
  tarjeta: string;
  matricula: string;
  actividad: string;
  inicio: string;
  fin: string;
  estado: string;
  regimen: string;
}

// ====================================
// Parser
// ====================================

/**
 * Detecta si un buffer contiene un CSV del Ministerio de Transporte.
 * Busca la cabecera esperada en la primera línea.
 */
export function isMinistryCSV(buffer: Buffer, fileName: string): boolean {
  // Check extension
  if (!fileName.toLowerCase().endsWith('.csv')) return false;
  
  // Check content (first ~200 bytes)
  const header = buffer.subarray(0, Math.min(200, buffer.length)).toString('utf-8');
  const firstLine = header.split(/[\r\n]/)[0].trim();
  
  // Check for expected header format
  const columns = firstLine.split(';').map(c => c.trim().toUpperCase());
  return columns.includes('TARJETA') && columns.includes('ACTIVIDAD') && columns.includes('INICIO');
}

/**
 * Parsea un CSV del Ministerio de Transporte y produce BinaryRawEvent[].
 */
export function parseMinistryCSV(buffer: Buffer, fileName: string): BinaryParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Detect encoding and decode
  const content = decodeCSVBuffer(buffer);
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  if (lines.length < 2) {
    return {
      success: false,
      fileType: 'DRIVER_CARD',
      parserVersion: 'csv-ministry-v1',
      metadata: {},
      rawEvents: [],
      warnings: [],
      errors: ['El archivo CSV está vacío o solo contiene cabecera.'],
    };
  }
  
  // Parse header
  const headerLine = lines[0].trim();
  const headerColumns = headerLine.split(';').map(c => c.trim().toUpperCase());
  
  // Validate header structure
  const headerMap: Record<string, number> = {};
  for (let i = 0; i < headerColumns.length; i++) {
    headerMap[headerColumns[i]] = i;
  }
  
  const requiredColumns = ['TARJETA', 'MATRICULA', 'ACTIVIDAD', 'INICIO', 'FIN'];
  for (const col of requiredColumns) {
    if (!(col in headerMap)) {
      return {
        success: false,
        fileType: 'DRIVER_CARD',
        parserVersion: 'csv-ministry-v1',
        metadata: {},
        rawEvents: [],
        warnings: [],
        errors: [`Columna obligatoria '${col}' no encontrada en cabecera CSV. Columnas: ${headerColumns.join(', ')}`],
      };
    }
  }
  
  // Parse rows
  const rows: CsvActivityRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(';');
    if (parts.length < requiredColumns.length) {
      warnings.push(`Línea ${i + 1}: formato incorrecto, se esperaban al menos ${requiredColumns.length} columnas.`);
      continue;
    }
    
    rows.push({
      tarjeta: parts[headerMap['TARJETA']]?.trim() || '',
      matricula: parts[headerMap['MATRICULA']]?.trim() || '',
      actividad: parts[headerMap['ACTIVIDAD']]?.trim() || '',
      inicio: parts[headerMap['INICIO']]?.trim() || '',
      fin: parts[headerMap['FIN']]?.trim() || '',
      estado: (headerMap['ESTADO'] !== undefined ? parts[headerMap['ESTADO']]?.trim() : '') || '',
      regimen: (headerMap['REGIMEN'] !== undefined ? parts[headerMap['REGIMEN']]?.trim() : '') || '',
    });
  }
  
  if (rows.length === 0) {
    return {
      success: false,
      fileType: 'DRIVER_CARD',
      parserVersion: 'csv-ministry-v1',
      metadata: {},
      rawEvents: [],
      warnings,
      errors: ['No se encontraron filas de actividad válidas en el CSV.'],
    };
  }
  
  // Extract metadata
  const tarjetas = new Set(rows.map(r => r.tarjeta));
  const matriculas = new Set(rows.map(r => r.matricula).filter(Boolean));
  const cardNumber = tarjetas.size === 1 ? [...tarjetas][0] : undefined;
  
  // Parse activity rows into BinaryRawEvent[]
  const rawEvents: BinaryRawEvent[] = [];
  let parseErrors = 0;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Parse dates
    const startDate = parseCSVDate(row.inicio);
    const endDate = parseCSVDate(row.fin);
    
    if (!startDate || !endDate) {
      warnings.push(`Fila ${i + 2}: fecha inválida (inicio='${row.inicio}', fin='${row.fin}').`);
      parseErrors++;
      continue;
    }
    
    // Map activity type
    const activityCode = row.actividad.toUpperCase();
    const activityType = ACTIVITY_MAP[activityCode];
    if (!activityType) {
      warnings.push(`Fila ${i + 2}: tipo de actividad desconocido '${activityCode}'.`);
      parseErrors++;
      continue;
    }
    
    // Duration validation
    const durationMs = endDate.getTime() - startDate.getTime();
    if (durationMs <= 0) {
      warnings.push(`Fila ${i + 2}: duración negativa o cero (${row.inicio} → ${row.fin}).`);
      continue;
    }
    if (durationMs > 24 * 60 * 60 * 1000) {
      warnings.push(`Fila ${i + 2}: duración > 24h (${Math.round(durationMs / 60000)} min). Se incluye pero con status SUSPECT.`);
    }
    
    const event: BinaryRawEvent = {
      rawStartAt: startDate,
      rawEndAt: endDate,
      rawActivityType: activityType,
      rawDriverIdentifier: row.tarjeta || null,
      rawVehicleIdentifier: row.matricula || null,
      rawPayload: {
        slot: 0,
        cardInserted: true,
        byteOffset: i,
        headerOffset: 0,
        dayTimestamp: Math.floor(startDate.getTime() / 1000),
        csvLineNumber: i + 2,
        csvActividad: activityCode,
        csvEstado: row.estado,
        csvRegimen: row.regimen,
      } as any,
      extractionMethod: 'spec',
      extractionNotes: `CSV Ministry row ${i + 2}: ${activityCode} ${row.matricula} ${row.inicio}-${row.fin}`,
      extractionStatus: durationMs > 24 * 60 * 60 * 1000 ? 'SUSPECT' : 'OK',
    };
    
    rawEvents.push(event);
  }
  
  // Sort by start time
  rawEvents.sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
  
  // Find date range
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (rawEvents.length > 0) {
    dateFrom = rawEvents[0].rawStartAt;
    dateTo = rawEvents[rawEvents.length - 1].rawEndAt;
  }
  
  // Extract DNI from card number (E + 8 digits + letter + version)
  let driverDni: string | undefined;
  if (cardNumber) {
    const dniMatch = cardNumber.match(/^E(\d{8}[A-Za-z])/);
    if (dniMatch) {
      driverDni = dniMatch[1].toUpperCase();
    }
  }
  
  // Extract unique plates and find the primary one (most used)
  const plateCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.matricula && !row.matricula.includes('?')) {
      const count = plateCounts.get(row.matricula) || 0;
      plateCounts.set(row.matricula, count + 1);
    }
  }
  const primaryPlate = plateCounts.size > 0
    ? [...plateCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : undefined;
  
  // Summary info
  const uniqueDays = new Set(rawEvents.map(e => e.rawStartAt.toISOString().substring(0, 10)));
  
  warnings.push(
    `Parser CSV Ministerio: ${rawEvents.length} actividades extraídas de ${rows.length} filas, ` +
    `${uniqueDays.size} días únicos, ${matriculas.size} matrículas detectadas` +
    (parseErrors > 0 ? `, ${parseErrors} filas con errores` : '') + '.'
  );
  
  return {
    success: true,
    fileType: 'DRIVER_CARD',
    parserVersion: 'csv-ministry-v1',
    metadata: {
      cardNumber,
      driverDni,
      plateNumber: primaryPlate,
      dateFrom,
      dateTo,
      allPlates: [...matriculas],
      totalActivities: rawEvents.length,
      uniqueDays: uniqueDays.size,
    },
    rawEvents,
    warnings,
    errors,
  };
}

// ====================================
// Utilities
// ====================================

/**
 * Parsea una fecha en formato DD/MM/YYYY HH:MM
 */
function parseCSVDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Expected format: DD/MM/YYYY HH:MM
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  
  // Validate ranges
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
    return null;
  }
  if (year < 2000 || year > 2100) {
    return null;
  }
  
  // Create as UTC (tachograph data is typically in UTC)
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}

/**
 * Intenta decodificar el CSV detectando la codificación.
 * El Ministerio puede generar CSV en UTF-8, Latin1, o UTF-16.
 */
function decodeCSVBuffer(buffer: Buffer): string {
  // Check for BOM
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE BOM
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE — convert manually
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length - 1; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString('utf16le');
  }
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 BOM
    return buffer.subarray(3).toString('utf-8');
  }
  
  // Try UTF-8 first
  const utf8 = buffer.toString('utf-8');
  
  // Simple heuristic: if we find replacement chars, try latin1
  if (utf8.includes('\ufffd')) {
    return buffer.toString('latin1');
  }
  
  return utf8;
}
