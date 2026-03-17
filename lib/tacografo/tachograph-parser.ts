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
import { isMinistryCSV, parseMinistryCSV } from './tachograph-csv-parser';

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
const KNOWN_EXTENSIONS = ['.ddd', '.dtco', '.tgd', '.v1b', '.c1b', '.esm', '.csv'];

import { detectFileType, extractPlateFromFileName, extractCardInfoFromFileName, extractDatesFromFileName } from './tachograph-file-utils';

// Re-export detectFileType for backward compatibility
export { detectFileType };

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
    // Check if this is a Ministry CSV file first
    if (isMinistryCSV(fileBuffer, fileName)) {
      console.log('[TachographParser] Detected Ministry CSV format, using CSV parser.');
      const csvResult = parseMinistryCSV(fileBuffer, fileName);
      
      // Supplement metadata from filename
      if (!csvResult.metadata.plateNumber) {
        const plate = extractPlateFromFileName(fileName);
        if (plate) {
          csvResult.metadata.plateNumber = plate;
          csvResult.warnings.push('La matrícula se extrajo del nombre del archivo.');
        }
      }
      
      const cardInfo = extractCardInfoFromFileName(fileName);
      if (!csvResult.metadata.cardNumber && cardInfo.cardNumber) {
        csvResult.metadata.cardNumber = cardInfo.cardNumber;
      }
      if (cardInfo.dni) {
        csvResult.metadata.driverDni = cardInfo.dni;
      }
      
      // Generate legacy activities from raw events
      const legacyActivities = rawEventsToLegacyActivities(csvResult.rawEvents);
      
      return {
        success: csvResult.success,
        parserVersion: csvResult.parserVersion,
        fileType: csvResult.fileType,
        metadata: csvResult.metadata,
        rawEvents: csvResult.rawEvents,
        activities: legacyActivities,
        warnings: csvResult.warnings,
        errors: csvResult.errors,
      };
    }
    
    // Detect file type from name + binary content
    const detectedType = detectFileType(fileName, fileBuffer);
    let specDiagnosticWarnings: string[] = [];
    
    // For DRIVER_CARD files, try spec parser first (TLV-based, EU 2016/799)
    if (detectedType === 'DRIVER_CARD' || detectedType === 'UNKNOWN') {
      const { parseDriverCardSpec } = await import('./tachograph-spec-parser');
      const specResult = parseDriverCardSpec(fileBuffer, fileName);
      
      if (specResult.rawEvents.length > 0) {
        console.log(`[TachographParser] Spec parser extracted ${specResult.rawEvents.length} events from ${new Set(specResult.rawEvents.map(e => e.rawStartAt.toISOString().substring(0, 10))).size} days.`);
        
        // Supplement metadata from filename
        if (!specResult.metadata.plateNumber) {
          const plate = extractPlateFromFileName(fileName);
          if (plate) {
            specResult.metadata.plateNumber = plate;
            specResult.warnings.push('La matrícula se extrajo del nombre del archivo.');
          }
        }
        
        const cardInfo = extractCardInfoFromFileName(fileName);
        if (!specResult.metadata.cardNumber && cardInfo.cardNumber) {
          specResult.metadata.cardNumber = cardInfo.cardNumber;
        }
        if (cardInfo.dni) {
          specResult.metadata.driverDni = cardInfo.dni;
        }
        
        const legacyActivities = rawEventsToLegacyActivities(specResult.rawEvents);
        
        return {
          success: specResult.success,
          parserVersion: specResult.parserVersion,
          fileType: specResult.fileType,
          metadata: specResult.metadata,
          rawEvents: specResult.rawEvents,
          activities: legacyActivities,
          warnings: specResult.warnings,
          errors: specResult.errors,
        };
      }
      
      // Spec parser found no events — fall back to heuristic
      // BUT preserve spec parser warnings for diagnostics (including hex dump)
      console.log('[TachographParser] Spec parser found 0 events, falling back to heuristic parser.');
      specResult.warnings.forEach(w => console.log(`  [spec-warning] ${w}`));
      specDiagnosticWarnings = specResult.warnings.map(w => `[SPEC] ${w}`);
    }
    
    // Fallback: heuristic binary parser
    const { parseBinaryTachograph } = await import('./tachograph-binary-parser');
    const result = parseBinaryTachograph(fileBuffer, fileName);
    
    // Add spec diagnostic warnings to result
    if (specDiagnosticWarnings.length > 0) {
      result.warnings.push(...specDiagnosticWarnings);
    }
    
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
      result.fileType = detectedType;
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
