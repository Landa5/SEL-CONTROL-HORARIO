/**
 * TachographParser - Stub Parser v1
 * 
 * Capa de abstracción para parseo de archivos de tacógrafo.
 * En FASE 1 se implementa como stub: extrae metadatos básicos del nombre del archivo.
 * En FASE 2 se reemplazará por un parser real DDD/DTCO o microservicio externo.
 * 
 * IMPORTANTE: No modificar la interfaz TachographParseResult.
 * Toda la capa de servicios depende de esta interfaz.
 */

export interface TachographParseResult {
  success: boolean;
  parserVersion: string;
  fileType: 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN';
  
  // Metadatos extraídos
  metadata: {
    driverName?: string;
    cardNumber?: string;
    plateNumber?: string;
    vin?: string;
    dateFrom?: Date;
    dateTo?: Date;
    [key: string]: any;
  };
  
  // Actividades extraídas
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

// Supported file extensions for tachograph data
const KNOWN_EXTENSIONS = ['.ddd', '.dtco', '.tgd', '.v1b', '.c1b', '.esm'];

/**
 * Detecta el tipo de archivo basándose en la extensión y nombre.
 */
function detectFileType(fileName: string): 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN' {
  const lower = fileName.toLowerCase();
  
  // Driver card files typically have C1B extension or contain "driver"/"conductor"/"card"
  if (lower.endsWith('.c1b') || lower.includes('driver') || lower.includes('card') || lower.includes('conductor') || lower.includes('tarjeta')) {
    return 'DRIVER_CARD';
  }
  
  // Vehicle unit files typically have V1B extension or contain "vehicle"/"vehiculo"/"vu"
  if (lower.endsWith('.v1b') || lower.includes('vehicle') || lower.includes('vehiculo') || lower.includes('_vu_') || lower.includes('_vu.')) {
    return 'VEHICLE_UNIT';
  }
  
  // DDD and DTCO can be either - try to detect from filename patterns
  if (lower.endsWith('.ddd') || lower.endsWith('.dtco') || lower.endsWith('.tgd') || lower.endsWith('.esm')) {
    // If filename contains a plate pattern (e.g., 1234ABC, AB1234CD), likely vehicle unit
    if (/\d{4}[a-z]{3}/i.test(fileName) || /[a-z]{2}\d{4}[a-z]{2}/i.test(fileName)) {
      return 'VEHICLE_UNIT';
    }
    return 'UNKNOWN';
  }
  
  return 'UNKNOWN';
}

/**
 * Intenta extraer matrícula del nombre del archivo.
 */
function extractPlateFromFileName(fileName: string): string | undefined {
  // Spanish plate formats: 1234ABC, B1234AB
  const patterns = [
    /(\d{4}[A-Z]{3})/i,        // 1234ABC (new format)
    /([A-Z]{1,2}\d{4}[A-Z]{2})/i, // B1234AB (old format)
  ];
  
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return undefined;
}

/**
 * Intenta extraer fechas del nombre del archivo.
 * Busca patrones como YYYYMMDD, YYYY-MM-DD
 */
function extractDatesFromFileName(fileName: string): { dateFrom?: Date; dateTo?: Date } {
  const datePatterns = [
    /(\d{4})[-_]?(\d{2})[-_]?(\d{2})/g,  // YYYYMMDD or YYYY-MM-DD
    /(\d{2})[-_](\d{2})[-_](\d{4})/g      // DD-MM-YYYY
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
    dateTo: dates.length > 1 ? dates[dates.length - 1] : dates[0]
  };
}

/**
 * Parser stub principal.
 * En FASE 1 solo extrae lo que puede del nombre del archivo.
 * En FASE 2 se reemplazará por parseo binario real.
 */
export async function parseTachographFile(
  fileName: string,
  fileBuffer: Buffer,
  _extension: string
): Promise<TachographParseResult> {
  // Intentar parseo binario real del contenido del archivo
  try {
    const { parseBinaryTachograph } = await import('./tachograph-binary-parser');
    const result = parseBinaryTachograph(fileBuffer, fileName);
    
    // Si el binario no detectó matrícula, intentar del nombre
    if (!result.metadata.plateNumber) {
      const plate = extractPlateFromFileName(fileName);
      if (plate) {
        result.metadata.plateNumber = plate;
        result.warnings.push('La matrícula se extrajo del nombre del archivo.');
      }
    }

    // Si no detectó fechas, intentar del nombre
    if (!result.metadata.dateFrom) {
      const dates = extractDatesFromFileName(fileName);
      if (dates.dateFrom) result.metadata.dateFrom = dates.dateFrom;
      if (dates.dateTo) result.metadata.dateTo = dates.dateTo;
    }

    // Si el binario no determinó tipo, intentar por nombre
    if (result.fileType === 'UNKNOWN') {
      result.fileType = detectFileType(fileName);
    }

    return result;
  } catch (binaryError: any) {
    // Si falla el parser binario, caer al parser de nombre de archivo
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
      activities: [],
      warnings,
      errors
    };
  }
}

/**
 * Valida si la extensión del archivo es soportada.
 */
export function isValidTachographExtension(extension: string): boolean {
  return KNOWN_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Devuelve las extensiones soportadas.
 */
export function getSupportedExtensions(): string[] {
  return [...KNOWN_EXTENSIONS];
}
