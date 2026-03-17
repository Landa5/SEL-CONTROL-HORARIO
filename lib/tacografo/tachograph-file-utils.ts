/**
 * Utilidades compartidas para ficheros de tacógrafo.
 * 
 * Este módulo es la ÚNICA fuente de verdad para la detección de tipo
 * de fichero. NO duplicar esta lógica en otros módulos.
 */

export type TachoFileType = 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN';

/**
 * FUNCIÓN CENTRALIZADA de detección de tipo de fichero de tacógrafo.
 * Esta es la ÚNICA fuente de verdad — NO duplicar esta lógica.
 * 
 * Estrategia multicapa:
 * 1. Extensión determinista (.c1b → DRIVER_CARD, .v1b → VEHICLE_UNIT)
 * 2. Palabras clave en nombre (driver, vehicle, conductor, etc.)
 * 3. Prefijo del nombre de fichero (C_ → DRIVER_CARD, V_/S_/M_/E_ → VEHICLE_UNIT)
 * 4. Patrón de matrícula en nombre → VEHICLE_UNIT
 * 5. Contenido binario (DNI → DRIVER_CARD, VIN → VEHICLE_UNIT) si se pasa buffer
 */
export function detectFileType(fileName: string, buffer?: Buffer): TachoFileType {
  const lower = fileName.toLowerCase();
  const baseName = fileName.split(/[\\/]/).pop()?.toUpperCase() || '';
  
  // Capa 1: Extensión determinista
  if (lower.endsWith('.c1b')) return 'DRIVER_CARD';
  if (lower.endsWith('.v1b') || lower.endsWith('.esm')) return 'VEHICLE_UNIT';
  
  // Capa 2: Palabras clave en nombre
  if (lower.includes('driver') || lower.includes('card') || lower.includes('conductor') || lower.includes('tarjeta')) {
    return 'DRIVER_CARD';
  }
  if (lower.includes('vehicle') || lower.includes('vehiculo') || lower.includes('_vu_') || lower.includes('_vu.')) {
    return 'VEHICLE_UNIT';
  }
  
  // Capa 3: Prefijo del nombre (para .ddd, .dtco, .tgd y otros formatos binarios)
  // Prefijos de conductor: C_ (card), C1_, C2_
  if (baseName.startsWith('C_') || baseName.startsWith('C1_') || baseName.startsWith('C2_')) {
    return 'DRIVER_CARD';
  }
  // Prefijos de vehículo: V_ (vehicle), S_ (speed/sensor), M_ (mass memory), E_ (equipo)
  if (baseName.startsWith('V_') || baseName.startsWith('S_') || baseName.startsWith('M_') || baseName.startsWith('E_')) {
    return 'VEHICLE_UNIT';
  }
  
  // Capa 4: Patrón de matrícula en nombre → indica fichero de vehículo
  if (/\d{4}[a-z]{3}/i.test(fileName) || /[a-z]{2}\d{4}[a-z]{2}/i.test(fileName)) {
    return 'VEHICLE_UNIT';
  }
  
  // Capa 5: Análisis de contenido binario (si se dispone de buffer)
  if (buffer && buffer.length > 100) {
    // Buscar patrón de DNI/NIE español (ej: E29028003W) → indica tarjeta de conductor
    const text = buffer.toString('ascii', 0, Math.min(buffer.length, 5000)).replace(/[^\x20-\x7E]/g, '');
    if (/E\d{8}[A-Z]/i.test(text)) return 'DRIVER_CARD';
    // Buscar VIN (17 caracteres alfanuméricos) → indica unidad de vehículo
    if (/[A-HJ-NPR-Z0-9]{17}/i.test(text)) return 'VEHICLE_UNIT';
  }
  
  return 'UNKNOWN';
}

/**
 * Extrae matrícula del nombre del fichero.
 */
export function extractPlateFromFileName(fileName: string): string | undefined {
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

/**
 * Extrae número de tarjeta y DNI del nombre del fichero.
 */
export function extractCardInfoFromFileName(fileName: string): { cardNumber?: string; dni?: string } {
  const baseName = fileName.split(/[\\/]/).pop() || '';
  const match = baseName.match(/E(\d{8}[A-Za-z])(\d{4,8})/);
  if (match) {
    const dni = match[1].toUpperCase();
    const version = match[2];
    return { cardNumber: `E${dni}${version}`, dni };
  }
  return {};
}

/**
 * Extrae fechas del nombre del fichero.
 */
export function extractDatesFromFileName(fileName: string): { dateFrom?: Date; dateTo?: Date } {
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
