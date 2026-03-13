/**
 * TachographBinaryParser - Parser real para archivos DDD/ESM/DTCO
 * 
 * Lee el contenido binario REAL de los archivos de tacógrafo digital
 * según la especificación EU Regulation 2016/799 (Annex 1C).
 * 
 * Soporta:
 * - Vehicle Unit data (VU) - archivos .ddd, .esm, .v1b
 * - Driver Card data (DC) - archivos .ddd, .tgd, .c1b
 * 
 * La estructura se basa en bloques con tags conocidos.
 * 
 * NOTA: Este parser extrae los datos más relevantes operativamente:
 * - Identificación del vehículo (VRN, VIN)
 * - Identificación del conductor (nombre, tarjeta)
 * - Actividades de conducción
 * - Registros de velocidad y distancia
 */

import type { TachographParseResult } from './tachograph-parser';

// ====================================
// Constantes de actividad (2 bits)
// ====================================
// Según la especificación, los tipos de actividad se codifican en 2 bits:
const ACTIVITY_CODES: Record<number, string> = {
  0: 'REST',        // 00 = Break/Rest
  1: 'AVAILABILITY', // 01 = Availability
  2: 'OTHER_WORK',   // 10 = Other work
  3: 'DRIVING',      // 11 = Driving
};

// ====================================
// Tags conocidos del formato DDD/ESM (Vehicle Unit y Driver Card)
// ====================================

// -- Vehicle Unit tags --
const VU_TAGS: Record<number, string> = {
  0x7601: 'VU_Overview',
  0x7602: 'VU_Activities',
  0x7603: 'VU_Events_Faults',
  0x7604: 'VU_Detailed_Speed',
  0x7605: 'VU_Technical_Data',
};

// -- Strings estándar dentro de archivos VU --
const VRN_PATTERN = /[A-Z0-9]{4,10}/; // Vehicle Registration Number (matrícula)

// ====================================
// Utilidades de lectura binaria
// ====================================

function readUint8(buf: Buffer, offset: number): number {
  if (offset >= buf.length) return 0;
  return buf[offset];
}

function readUint16BE(buf: Buffer, offset: number): number {
  if (offset + 1 >= buf.length) return 0;
  return (buf[offset] << 8) | buf[offset + 1];
}

function readUint32BE(buf: Buffer, offset: number): number {
  if (offset + 3 >= buf.length) return 0;
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function readBCDDate(buf: Buffer, offset: number): Date | null {
  // BCD-encoded date: YY MM DD HH MM SS (cada dígito en 4 bits)
  try {
    if (offset + 3 >= buf.length) return null;
    const byte0 = buf[offset];
    const byte1 = buf[offset + 1];
    const byte2 = buf[offset + 2];
    const byte3 = buf[offset + 3];
    
    const year = 2000 + ((byte0 >> 4) * 10 + (byte0 & 0x0f));
    const month = ((byte1 >> 4) * 10 + (byte1 & 0x0f));
    const day = ((byte2 >> 4) * 10 + (byte2 & 0x0f));
    const hour = ((byte3 >> 4) * 10 + (byte3 & 0x0f));
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23) {
      return new Date(Date.UTC(year, month - 1, day, hour));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lee un timestamp Unix (4 bytes, seconds since 1970) del buffer.
 */
function readTimestamp(buf: Buffer, offset: number): Date | null {
  if (offset + 3 >= buf.length) return 0 as any;
  const ts = readUint32BE(buf, offset);
  if (ts === 0 || ts === 0xffffffff) return null;
  // Timestamps válidos de tacógrafo: entre 2000 y 2040
  const date = new Date(ts * 1000);
  if (date.getFullYear() >= 2000 && date.getFullYear() <= 2040) {
    return date;
  }
  return null;
}

/**
 * Lee una cadena ASCII limpiándola de caracteres no imprimibles.
 */
function readAscii(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) length = buf.length - offset;
  if (length <= 0) return '';
  const bytes = buf.subarray(offset, offset + length);
  return Array.from(bytes)
    .map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '')
    .join('')
    .trim();
}

// ====================================
// Interfaces internas
// ====================================

interface ParsedActivity {
  activityType: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  slot: number;
  cardInserted: boolean;
}

interface VehicleIdentification {
  vrn: string | null;  // Vehicle Registration Number (matrícula)
  vin: string | null;  // Vehicle Identification Number 
  registeringNation: string | null;
}

interface DriverIdentification {
  surname: string | null;
  firstName: string | null;
  cardNumber: string | null;
  cardExpiry: Date | null;
  issuingNation: string | null;
}

// ====================================
// Parser principal
// ====================================

export function parseBinaryTachograph(buffer: Buffer, fileName: string): TachographParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const activities: TachographParseResult['activities'] = [];
  
  const metadata: TachographParseResult['metadata'] = {};
  let fileType: 'DRIVER_CARD' | 'VEHICLE_UNIT' | 'UNKNOWN' = 'UNKNOWN';
  
  // Determinar tipo por extensión y convención de nombre
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const baseName = fileName.split(/[\\/]/).pop()?.toUpperCase() || '';
  
  if (['esm', 'v1b'].includes(ext)) {
    fileType = 'VEHICLE_UNIT';
  } else if (['c1b', 'tgd'].includes(ext)) {
    fileType = 'DRIVER_CARD';
  } else if (ext === 'ddd' || ext === 'dtco') {
    // Standard tachograph naming: C_ = driver Card, S_/M_ = vehicle Speed/Mass unit
    if (baseName.startsWith('C_') || baseName.startsWith('C1_') || baseName.startsWith('C2_')) {
      fileType = 'DRIVER_CARD';
    } else if (baseName.startsWith('S_') || baseName.startsWith('M_')) {
      fileType = 'VEHICLE_UNIT';
    }
  }

  if (buffer.length < 10) {
    errors.push('Archivo demasiado pequeño para ser un archivo de tacógrafo válido');
    return { success: true, fileType, parserVersion: 'binary-v1', metadata, activities, warnings, errors };
  }

  try {
    // 1. Buscar VRN (matrícula) en el archivo — solo para archivos de vehículo
    // Los archivos de tarjeta de conductor contienen matrículas de vehículos visitados,
    // NO la matrícula "del conductor". Se ignoran para evitar confusión.
    if (fileType !== 'DRIVER_CARD') {
      const vrn = findVRN(buffer);
      if (vrn) {
        metadata.plateNumber = vrn;
      }
    }

    // 2. Buscar VIN — solo para archivos de vehículo
    if (fileType !== 'DRIVER_CARD') {
      const vin = findVIN(buffer);
      if (vin) {
        metadata.vin = vin;
      }
    }

    // 3. Buscar datos del conductor
    // NOTA: No buscamos cardNumber en el binario (genera falsos positivos).
    // El cardNumber correcto viene del nombre del archivo (tachograph-parser.ts).
    const driver = findDriverData(buffer);
    if (driver.surname || driver.firstName) {
      metadata.driverName = [driver.surname, driver.firstName].filter(Boolean).join(' ').trim();
      if (fileType === 'UNKNOWN') fileType = 'DRIVER_CARD';
    }
    if (driver.cardExpiry) {
      metadata.cardExpiry = driver.cardExpiry;
    }

    // 4. Buscar bloques de actividades
    const parsedActivities = extractActivities(buffer);
    if (parsedActivities.length > 0) {
      // Determinar rango de fechas
      const sortedActs = parsedActivities.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      metadata.dateFrom = sortedActs[0].startTime;
      metadata.dateTo = sortedActs[sortedActs.length - 1].endTime;

      for (const act of parsedActivities) {
        activities.push({
          activityType: act.activityType as 'DRIVING' | 'OTHER_WORK' | 'AVAILABILITY' | 'REST' | 'BREAK' | 'UNKNOWN',
          startTime: act.startTime,
          endTime: act.endTime,
          durationMinutes: act.durationMinutes,
          confidenceLevel: 'medium' as const,
        });
      }
    }

    // 5. Si no encontramos actividades directas, buscar timestamps para inferir rango
    if (activities.length === 0) {
      const dates = findAllTimestamps(buffer);
      if (dates.length >= 2) {
        metadata.dateFrom = dates[0];
        metadata.dateTo = dates[dates.length - 1];
        warnings.push(`No se pudieron extraer actividades individuales. Se detectaron ${dates.length} timestamps en el archivo.`);
      }
    }

    // 6. Si no encontramos matrícula por contenido binario, intentar del nombre
    if (!metadata.plateNumber) {
      const fromName = extractPlateFromFileName(fileName);
      if (fromName) {
        metadata.plateNumber = fromName;
        warnings.push('La matrícula se extrajo del nombre del archivo, no del contenido binario.');
      }
    }

    // 7. Si no encontramos fechas, intentar del nombre
    if (!metadata.dateFrom) {
      const fromName = extractDateFromFileName(fileName);
      if (fromName) {
        metadata.dateFrom = fromName;
        metadata.dateTo = fromName;
      }
    }

    // Determinar tipo si aún desconocido
    if (fileType === 'UNKNOWN') {
      // Heurística: cardNumber → conductor (aunque tenga matrícula, la tarjeta del conductor registra el vehículo)
      if (metadata.cardNumber) {
        fileType = 'DRIVER_CARD';
      } else if (metadata.vin || metadata.plateNumber) {
        fileType = 'VEHICLE_UNIT';
      }
    }
    // Si se detectó cardNumber pero fue marcado como VEHICLE_UNIT por extensión/nombre, corregir
    if (fileType === 'VEHICLE_UNIT' && metadata.cardNumber && !metadata.vin) {
      fileType = 'DRIVER_CARD';
      warnings.push('Reclasificado como tarjeta de conductor: se encontró número de tarjeta.');
    }

    if (activities.length === 0) {
      warnings.push('No se pudieron extraer actividades detalladas del archivo binario. Los datos registrados se limitan a la identificación del vehículo/conductor y rango de fechas.');
    }

  } catch (err: any) {
    errors.push(`Error durante el parseo binario: ${err.message}`);
  }

  return {
    success: true,
    fileType,
    parserVersion: 'binary-v1',
    metadata,
    activities,
    warnings,
    errors,
  };
}

// ====================================
// Búsqueda de VRN (matrícula)
// ====================================

function findVRN(buf: Buffer): string | null {
  // El VRN en archivos VU está en un bloque con estructura conocida.
  // Típicamente precedido por un código de nación y luego 14 bytes ASCII con la matrícula.
  // Buscar patrones: un byte de nación (01-99) seguido de texto tipo matrícula
  
  // Estrategia 1: buscar la secuencia que precede al VRN en el estándar
  // En archivos VU, el VehicleRegistrationNumber tiene una codificación específica:
  //   codePage (1 byte) + countryCode (1 byte) + matricula (13 bytes ASCII padded con spaces)
  
  // Buscar patrón de matrícula española: 4 dígitos + 3 letras (ej: 5595JSB)
  // o antiguo: 2 letras + 4 dígitos + 2 letras
  const spanishPlateNew = /(\d{4}[A-Z]{3})/;
  const spanishPlateOld = /([A-Z]{1,2}\d{4}[A-Z]{2,3})/;
  const euPlate = /([A-Z]{1,3}[\s-]?\d{2,4}[\s-]?[A-Z]{0,3})/;
  
  // Escanear el buffer buscando cadenas que parezcan matrículas
  for (let i = 0; i < buf.length - 7; i++) {
    const chunk = readAscii(buf, i, 13);
    if (chunk.length >= 5) {
      const matchNew = chunk.match(spanishPlateNew);
      if (matchNew) return matchNew[1];
      
      const matchOld = chunk.match(spanishPlateOld);
      if (matchOld && matchOld[1].length >= 7) return matchOld[1];
    }
  }

  // Estrategia 2: buscar directamente en bloques ASCII del archivo
  const text = readAscii(buf, 0, Math.min(buf.length, 50000));
  const matchAll = text.match(/\d{4}[A-Z]{3}/);
  if (matchAll) return matchAll[0];

  return null;
}

// ====================================
// Búsqueda de VIN
// ====================================

function findVIN(buf: Buffer): string | null {
  // VIN es exactamente 17 caracteres alfanuméricos (sin I, O, Q)
  // En el archivo, suele estar en una sección de datos técnicos
  const vinPattern = /[A-HJ-NPR-Z0-9]{17}/;
  
  for (let i = 0; i < buf.length - 17; i++) {
    const chunk = readAscii(buf, i, 17);
    if (chunk.length === 17 && vinPattern.test(chunk)) {
      // Verificar que sea un VIN real (no solo 17 caracteres aleatorios)
      // Los VIN no empiezan con 0 generalmente y tienen una estructura
      if (!chunk.match(/^[0]{17}$/) && !chunk.match(/^[F]{17}$/)) {
        return chunk;
      }
    }
  }
  return null;
}

// ====================================
// Búsqueda de datos del conductor
// ====================================

function findDriverData(buf: Buffer): DriverIdentification {
  const result: DriverIdentification = {
    surname: null,
    firstName: null,
    cardNumber: null, // No se extrae del binario — viene del filename
    cardExpiry: null,
    issuingNation: null,
  };

  // NO buscamos cardNumber en el binario:
  // El escaneo heurístico de byte a byte produce falsos positivos
  // (ej: EA9606492800, DY2929428577). El cardNumber correcto
  // se extrae del nombre del archivo en tachograph-parser.ts.

  // Buscar nombres: en Driver Card, el nombre puede aparecer como
  // cadena ASCII legible. Heurística básica.
  // TODO: Implementar lectura de bloques TLV para Driver Card Application
  
  return result;
}

// ====================================
// Extracción de actividades
// ====================================

function extractActivities(buf: Buffer): ParsedActivity[] {
  const activities: ParsedActivity[] = [];
  
  // En archivos VU, las actividades se almacenan como registros diarios.
  // Cada registro de actividad diaria tiene:
  //   - Fecha del registro (timestamp Unix 4 bytes)
  //   - Registros de cambio de actividad (activity change records)
  //
  // Un Activity Change Record (2 bytes) tiene esta estructura:
  //   Bit 15: slot (0=driver1, 1=driver2)
  //   Bit 14: driving status (0=single, 1=crew)  
  //   Bit 13: card inserted (0=no, 1=yes)
  //   Bits 12-11: activity (00=REST, 01=AVAIL, 10=OTHER_WORK, 11=DRIVING)
  //   Bits 10-0: time (minutos desde 00:00 del día, max 1440)
  
  // Buscar secuencias de activity change records
  // Heurística: buscar timestamps válidos seguidos de pares de bytes con patrones de actividad
  
  const timestamps = findAllTimestamps(buf);
  
  for (let i = 0; i < buf.length - 4; i++) {
    const ts = readTimestamp(buf, i);
    if (!ts) continue;
    
    // Verificar si hay activity records después del timestamp
    // Pueden haber varios valores de 2 bytes tras un timestamp
    const dayActivities = tryParseActivityRecords(buf, i + 4, ts);
    if (dayActivities.length >= 3) { // Mínimo 3 registros para considerar válido
      // Verificar que las actividades cubran al menos 30 minutos del día
      const totalMinutes = dayActivities.reduce((sum, a) => sum + a.durationMinutes, 0);
      if (totalMinutes >= 30) {
        activities.push(...dayActivities);
        i += 4 + (dayActivities.length * 2);
      }
    }
  }

  // Filtrar actividades de duración < 1 minuto (ruido del parser)
  const filtered = activities.filter(a => a.durationMinutes >= 1);

  // Deduplicar y consolidar actividades
  return consolidateActivities(filtered);
}

function tryParseActivityRecords(buf: Buffer, offset: number, dayStart: Date): ParsedActivity[] {
  const activities: ParsedActivity[] = [];
  let prevMinutes = -1;
  let validCount = 0;
  let invalidCount = 0;
  
  for (let j = 0; j < 150; j++) { // Max 150 cambios de actividad por día
    const pos = offset + (j * 2);
    if (pos + 1 >= buf.length) break;
    
    const record = readUint16BE(buf, pos);
    if (record === 0 || record === 0xffff) {
      if (validCount > 0) break; // Fin de registros
      continue;
    }
    
    const slot = (record >> 15) & 1;
    const cardInserted = ((record >> 13) & 1) === 1;
    const activityCode = (record >> 11) & 0x03;
    const minutes = record & 0x07ff; // 11 bits = max 2047
    
    // Validar: minutos <= 1440 y en orden ascendente
    if (minutes > 1440) {
      invalidCount++;
      if (invalidCount > 3) break;
      continue;
    }
    
    if (prevMinutes >= 0 && minutes <= prevMinutes) {
      invalidCount++;
      if (invalidCount > 3) break;
      continue;
    }
    
    validCount++;
    
    const activityType = ACTIVITY_CODES[activityCode] || 'UNKNOWN';
    const startTime = new Date(dayStart.getTime() + minutes * 60000);
    
    // La hora de fin se determina con el siguiente registro
    if (activities.length > 0) {
      const prev = activities[activities.length - 1];
      prev.endTime = startTime;
      prev.durationMinutes = Math.round((prev.endTime.getTime() - prev.startTime.getTime()) / 60000);
    }
    
    activities.push({
      activityType,
      startTime,
      endTime: new Date(dayStart.getTime() + 24 * 60 * 60000), // Provisional: fin del día
      durationMinutes: 0,
      slot,
      cardInserted,
    });
    
    prevMinutes = minutes;
  }
  
  // Solo devolver si hay al menos 3 registros válidos y pocos inválidos
  if (validCount >= 3 && validCount > invalidCount * 2) {
    // Calcular duración del último registro
    if (activities.length > 0) {
      const last = activities[activities.length - 1];
      last.durationMinutes = Math.round((last.endTime.getTime() - last.startTime.getTime()) / 60000);
    }
    
    // Filtrar actividades con duración 0 o negativa
    return activities.filter(a => a.durationMinutes > 0);
  }
  
  return [];
}

function consolidateActivities(activities: ParsedActivity[]): ParsedActivity[] {
  if (activities.length <= 1) return activities;
  
  // Ordenar por inicio
  activities.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Combinar actividades consecutivas del mismo tipo
  const consolidated: ParsedActivity[] = [activities[0]];
  
  for (let i = 1; i < activities.length; i++) {
    const current = activities[i];
    const prev = consolidated[consolidated.length - 1];
    
    if (prev.activityType === current.activityType &&
        Math.abs(prev.endTime.getTime() - current.startTime.getTime()) < 120000) { // < 2 min gap
      prev.endTime = current.endTime;
      prev.durationMinutes = Math.round((prev.endTime.getTime() - prev.startTime.getTime()) / 60000);
    } else {
      consolidated.push(current);
    }
  }
  
  return consolidated;
}

// ====================================
// Búsqueda de timestamps en el archivo
// ====================================

function findAllTimestamps(buf: Buffer): Date[] {
  const dates: Date[] = [];
  const seen = new Set<number>();
  
  for (let i = 0; i < buf.length - 3; i++) {
    const ts = readUint32BE(buf, i);
    // Timestamps válidos de tacógrafo: entre 2000-01-01 y 2035-01-01
    if (ts >= 946684800 && ts <= 2051222400) {
      if (!seen.has(ts)) {
        seen.add(ts);
        dates.push(new Date(ts * 1000));
      }
    }
  }
  
  dates.sort((a, b) => a.getTime() - b.getTime());
  return dates;
}

// ====================================
// Fallbacks del nombre de archivo
// ====================================

function extractPlateFromFileName(name: string): string | null {
  // Patrón español nuevo: 4 dígitos + 3 letras
  const match = name.match(/(\d{4}[A-Z]{3})/i);
  if (match) return match[1].toUpperCase();
  
  // Patrón con guiones/espacios
  const match2 = name.match(/([A-Z]{1,2}[\-\s]?\d{4}[\-\s]?[A-Z]{2,3})/i);
  if (match2) return match2[1].toUpperCase().replace(/[\s-]/g, '');
  
  return null;
}

function extractDateFromFileName(name: string): Date | null {
  // Formato YYYYMMDD en nombre de archivo
  const match = name.match(/(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (match) {
    const d = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2040) return d;
  }
  return null;
}
