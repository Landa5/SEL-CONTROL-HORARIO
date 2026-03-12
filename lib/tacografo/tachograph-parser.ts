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
  _fileBuffer: Buffer,
  _extension: string
): Promise<TachographParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Detect file type
  const fileType = detectFileType(fileName);
  if (fileType === 'UNKNOWN') {
    warnings.push('No se pudo determinar el tipo de archivo (tarjeta conductor / unidad vehículo). Se requiere revisión manual.');
  }
  
  // Extract metadata from filename
  const plate = extractPlateFromFileName(fileName);
  const dates = extractDatesFromFileName(fileName);
  
  const metadata: TachographParseResult['metadata'] = {};
  
  if (plate) {
    metadata.plateNumber = plate;
  } else if (fileType === 'VEHICLE_UNIT') {
    warnings.push('Archivo de unidad de vehículo sin matrícula detectable en el nombre.');
  }
  
  if (dates.dateFrom) metadata.dateFrom = dates.dateFrom;
  if (dates.dateTo) metadata.dateTo = dates.dateTo;
  
  if (!dates.dateFrom) {
    warnings.push('No se detectaron fechas en el nombre del archivo.');
  }
  
  // STUB: In FASE 2, binary parsing would extract activities here
  warnings.push('Parser stub v1: el parseo binario completo no está implementado. Los datos de actividad se generarán cuando se integre un parser DDD/DTCO real.');
  
  return {
    success: true,
    parserVersion: 'stub-v1',
    fileType,
    metadata,
    activities: [], // Empty in stub - real parser would populate this
    warnings,
    errors
  };
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
