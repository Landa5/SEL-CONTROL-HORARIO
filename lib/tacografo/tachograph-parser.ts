/**
 * TachographParser v2 — Capa de abstracción para parseo de archivos de tacógrafo
 * 
 * Delega al parser binario real (tachograph-binary-parser.ts) y aplica
 * fallbacks del nombre del archivo para datos faltantes.
 * 
 * CAMBIO v2: Retorna rawEvents (BinaryRawEvent[]) además de activities
 * legacy para compatibilidad durante la transición.
 */

import type { BinaryRawEvent, BinaryParseResult } from './tachograph-binary-parser';

export { BinaryRawEvent, BinaryParseResult };

export interface TachographParseResult {
  success: boolean;
  parserVersion: string;
  fileType: 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN';
  
  metadata: {
    driverName?: string;
    cardNumber?: string;
    plateNumber?: string;
    vin?: string;
    dateFrom?: Date;
    dateTo?: Date;
    driverDni?: string;
    [key: string]: any;
  };
  
  // v2: Raw events sin consolidar
  rawEvents: BinaryRawEvent[];
  
  // Legacy: actividades consolidadas (para compatibilidad con TachographActivityLegacy)
  activities: {
    activityType: 'DRIVING' | 'OTHER_WORK' | 'AVAILABILITY' | 'REST' | 'BREAK' | 'UNKNOWN';
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    countryStart?: string;
    countryEnd?: string;
    rawPayload?: any;
    confidenceLevel: 'low' | 'medium' | 'high';
  }[];
  
  warnings: string[];
  errors: string[];
}

// Supported file extensions
const KNOWN_EXTENSIONS = ['.ddd', '.dtco', '.tgd', '.v1b', '.c1b', '.esm'];

function detectFileType(fileName: string): 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN' {
  const lower = fileName.toLowerCase();
  const baseName = fileName.split(/[\\/]/).pop()?.toUpperCase() || '';
  
  if (lower.endsWith('.c1b') || lower.includes('driver') || lower.includes('card') || lower.includes('conductor') || lower.includes('tarjeta')) {
    return 'DRIVER_CARD';
  }
  if (lower.endsWith('.v1b') || lower.includes('vehicle') || lower.includes('vehiculo') || lower.includes('_vu_') || lower.includes('_vu.')) {
    return 'VEHICLE_UNIT';
  }
  if (lower.endsWith('.ddd') || lower.endsWith('.dtco') || lower.endsWith('.tgd') || lower.endsWith('.esm')) {
    if (baseName.startsWith('C_') || baseName.startsWith('C1_') || baseName.startsWith('C2_')) {
      return 'DRIVER_CARD';
    }
    if (baseName.startsWith('S_') || baseName.startsWith('M_') || baseName.startsWith('E_')) {
      return 'VEHICLE_UNIT';
    }
    if (/\d{4}[a-z]{3}/i.test(fileName) || /[a-z]{2}\d{4}[a-z]{2}/i.test(fileName)) {
      return 'VEHICLE_UNIT';
    }
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

function extractPlateFromFileName(fileName: string): string | undefined {
  const patterns = [
    /(\d{4}[A-Z]{3})/i,
    /([A-Z]{1,2}\d{4}[A-Z]{2})/i,
  ];
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return undefined;
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

function extractDatesFromFileName(fileName: string): { dateFrom?: Date; dateTo?: Date } {
  const datePatterns = [
    /(\d{4})[-_]?(\d{2})[-_]?(\d{2})/g,
    /(\d{2})[-_](\d{2})[-_](\d{4})/g,
  ];
  const dates: Date[] = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(fileName)) !== null) {
      let year: number, month: number, day: number;
      if (match[1].length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        day = parseInt(match[3]);
      } else {
        day = parseInt(match[1]);
        month = parseInt(match[2]) - 1;
        year = parseInt(match[3]);
      }
      if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        dates.push(new Date(year, month, day));
      }
    }
  }
  if (dates.length === 0) return {};
  dates.sort((a, b) => a.getTime() - b.getTime());
  return {
    dateFrom: dates[0],
    dateTo: dates.length > 1 ? dates[dates.length - 1] : dates[0],
  };
}

/**
 * Convierte BinaryRawEvent[] a legacy activities[] (consolidados)
 * para mantener compatibilidad con TachographActivityLegacy
 */
function rawEventsToLegacyActivities(rawEvents: BinaryRawEvent[]): TachographParseResult['activities'] {
  if (rawEvents.length === 0) return [];
  
  // Ordenar y consolidar actividades consecutivas del mismo tipo
  const sorted = [...rawEvents]
    .filter(e => e.extractionStatus !== 'ERROR')
    .sort((a, b) => a.rawStartAt.getTime() - b.rawStartAt.getTime());
  
  if (sorted.length === 0) return [];
  
  const consolidated: TachographParseResult['activities'] = [{
    activityType: sorted[0].rawActivityType as any,
    startTime: sorted[0].rawStartAt,
    endTime: sorted[0].rawEndAt,
    durationMinutes: Math.round((sorted[0].rawEndAt.getTime() - sorted[0].rawStartAt.getTime()) / 60000),
    confidenceLevel: sorted[0].extractionStatus === 'SUSPECT' ? 'low' : 'medium',
  }];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = consolidated[consolidated.length - 1];
    
    const sameType = prev.activityType === current.rawActivityType;
    const sameDay = prev.startTime.toISOString().substring(0, 10) === current.rawStartAt.toISOString().substring(0, 10);
    const smallGap = Math.abs(prev.endTime.getTime() - current.rawStartAt.getTime()) < 120000;
    
    if (sameType && sameDay && smallGap) {
      prev.endTime = current.rawEndAt;
      prev.durationMinutes = Math.round((prev.endTime.getTime() - prev.startTime.getTime()) / 60000);
    } else {
      consolidated.push({
        activityType: current.rawActivityType as any,
        startTime: current.rawStartAt,
        endTime: current.rawEndAt,
        durationMinutes: Math.round((current.rawEndAt.getTime() - current.rawStartAt.getTime()) / 60000),
        confidenceLevel: current.extractionStatus === 'SUSPECT' ? 'low' : 'medium',
      });
    }
  }
  
  return consolidated.filter(a => a.durationMinutes > 0 && a.durationMinutes <= 1440);
}

/**
 * Parser principal.
 */
export async function parseTachographFile(
  fileName: string,
  fileBuffer: Buffer,
  _extension: string
): Promise<TachographParseResult> {
  try {
    const { parseBinaryTachograph } = await import('./tachograph-binary-parser');
    const result = parseBinaryTachograph(fileBuffer, fileName);
    
    // Suplementar metadatos del nombre de archivo
    if (!result.metadata.plateNumber) {
      const plate = extractPlateFromFileName(fileName);
      if (plate) {
        result.metadata.plateNumber = plate;
        result.warnings.push('La matrícula se extrajo del nombre del archivo.');
      }
    }

    if (!result.metadata.dateFrom) {
      const dates = extractDatesFromFileName(fileName);
      if (dates.dateFrom) result.metadata.dateFrom = dates.dateFrom;
      if (dates.dateTo) result.metadata.dateTo = dates.dateTo;
    }

    const cardInfo = extractCardInfoFromFileName(fileName);
    if (cardInfo.cardNumber) {
      result.metadata.cardNumber = cardInfo.cardNumber;
    }
    if (cardInfo.dni) {
      result.metadata.driverDni = cardInfo.dni;
    }

    if (result.fileType === 'UNKNOWN') {
      result.fileType = detectFileType(fileName);
    }

    // Generar legacy activities desde raw events
    const legacyActivities = rawEventsToLegacyActivities(result.rawEvents);

    return {
      success: result.success,
      parserVersion: result.parserVersion,
      fileType: result.fileType,
      metadata: result.metadata,
      rawEvents: result.rawEvents,
      activities: legacyActivities,
      warnings: result.warnings,
      errors: result.errors,
    };
  } catch (binaryError: any) {
    console.error('Binary parser error, falling back to filename parser:', binaryError);
    
    const warnings: string[] = [];
    const errors: string[] = [];
    
    warnings.push(`El parseo binario falló (${binaryError.message}). Se extrajeron metadatos del nombre del archivo.`);
    
    const fileType = detectFileType(fileName);
    const plate = extractPlateFromFileName(fileName);
    const dates = extractDatesFromFileName(fileName);
    
    const metadata: TachographParseResult['metadata'] = {};
    if (plate) metadata.plateNumber = plate;
    if (dates.dateFrom) metadata.dateFrom = dates.dateFrom;
    if (dates.dateTo) metadata.dateTo = dates.dateTo;
    
    return {
      success: true,
      parserVersion: 'fallback-filename-v1',
      fileType,
      metadata,
      rawEvents: [],
      activities: [],
      warnings,
      errors,
    };
  }
}

export function isValidTachographExtension(extension: string): boolean {
  return KNOWN_EXTENSIONS.includes(extension.toLowerCase());
}

export function getSupportedExtensions(): string[] {
  return [...KNOWN_EXTENSIONS];
}
