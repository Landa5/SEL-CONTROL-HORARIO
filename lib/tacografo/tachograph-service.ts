/**
 * TachographService - Servicio principal del módulo Tacógrafo Digital
 * 
 * Pipeline de procesamiento:
 * 1. Validar archivo (extensión, tamaño)
 * 2. Calcular hash (deduplicación)
 * 3. Guardar archivo original
 * 4. Registrar importación en BD
 * 5. Parsear archivo (stub en FASE 1)
 * 6. Crear/vincular conductor y vehículo
 * 7. Crear actividades
 * 8. Generar resúmenes diarios
 * 9. Detectar incidencias
 */

import { prisma } from '@/lib/prisma';
import { parseTachographFile, isValidTachographExtension } from './tachograph-parser';
import type { TachographParseResult } from './tachograph-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Detectar si estamos en Vercel (filesystem de solo lectura)
const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL
  ? '/tmp/tacografo'
  : path.join(process.cwd(), 'public', 'uploads', 'tacografo');
const PROCESSED_DIR = path.join(UPLOAD_DIR, 'processed');
const ERROR_DIR = path.join(UPLOAD_DIR, 'errors');

/**
 * Intenta crear directorios. En Vercel solo funciona en /tmp.
 * Falla silenciosamente si no puede crear.
 */
function ensureDirectories() {
  try {
    for (const dir of [UPLOAD_DIR, PROCESSED_DIR, ERROR_DIR]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  } catch {
    // En Vercel u otro entorno read-only, ignorar
  }
}

/**
 * Intenta guardar archivo en disco. Devuelve la ruta relativa o null si falla.
 */
function trySaveFile(buffer: Buffer, safeFileName: string): string | null {
  try {
    ensureDirectories();
    const filePath = path.join(UPLOAD_DIR, safeFileName);
    fs.writeFileSync(filePath, buffer);
    return IS_VERCEL ? `/tmp/tacografo/${safeFileName}` : `/uploads/tacografo/${safeFileName}`;
  } catch {
    // Filesystem read-only (Vercel, etc.) — no guardamos archivo
    return null;
  }
}

/**
 * Calcula el hash SHA-256 de un buffer.
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Resultado del procesamiento de importación.
 */
export interface ImportProcessResult {
  success: boolean;
  importId?: number;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED_OK' | 'PROCESSED_WARNINGS' | 'ERROR';
  warnings: string[];
  errors: string[];
  driverName?: string;
  vehiclePlate?: string;
}

/**
 * Procesa un archivo de tacógrafo subido.
 */
export async function processImport(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string | null,
  uploadedById: number,
  sourceType: 'MANUAL_UPLOAD' | 'LOCAL_FOLDER' = 'MANUAL_UPLOAD'
): Promise<ImportProcessResult> {
  
  const warnings: string[] = [];
  const errors: string[] = [];
  const extension = path.extname(fileName).toLowerCase();
  
  // 1. Validate extension
  if (!isValidTachographExtension(extension)) {
    // Allow any extension but warn
    warnings.push(`La extensión '${extension}' no es una extensión estándar de tacógrafo. Se procesará igualmente.`);
  }
  
  // 2. Compute hash for deduplication
  const fileHash = computeFileHash(fileBuffer);
  
  // 3. Check for duplicates
  const existing = await prisma.tachographImport.findUnique({
    where: { fileHash }
  });
  
  if (existing) {
    // Create incident for duplicate
    await prisma.tachographIncident.create({
      data: {
        incidentType: 'DUPLICATE_FILE',
        severity: 'LOW',
        importId: existing.id,
        title: `Archivo duplicado: ${fileName}`,
        description: `Se intentó importar un archivo idéntico al ya importado (ID: ${existing.id}, ${existing.fileName}). Hash: ${fileHash}`,
      }
    });
    
    return {
      success: false,
      importId: existing.id,
      status: 'ERROR',
      warnings: [],
      errors: [`Archivo duplicado. Ya existe una importación con el mismo contenido (ID: ${existing.id})`]
    };
  }
  
  // 4. Intentar guardar archivo original en disco
  const timestamp = Date.now();
  const safeFileName = `${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const savedPath = trySaveFile(fileBuffer, safeFileName);
  if (!savedPath) {
    warnings.push('El archivo no se pudo guardar en disco (entorno serverless). Los datos se procesarán y guardarán en BD.');
  }
  
  // 5. Create import record
  const importRecord = await prisma.tachographImport.create({
    data: {
      sourceType,
      fileName,
      originalExtension: extension,
      mimeType,
      fileSize: fileBuffer.length,
      fileHash,
      importStatus: 'PROCESSING',
      rawFilePath: savedPath || `cloud-pending:${safeFileName}`,
      uploadedById,
    }
  });
  
  try {
    // 6. Parse file
    const parseResult = await parseTachographFile(fileName, fileBuffer, extension);
    warnings.push(...parseResult.warnings);
    errors.push(...parseResult.errors);
    
    // 7. Update import with parsed metadata
    const updateData: any = {
      fileType: parseResult.fileType,
      parserVersion: parseResult.parserVersion,
      rawMetadataJson: JSON.stringify(parseResult.metadata),
      processedAt: new Date(),
    };
    
    if (parseResult.metadata.driverName) {
      updateData.detectedDriverName = parseResult.metadata.driverName;
    }
    if (parseResult.metadata.cardNumber) {
      updateData.detectedCardNumber = parseResult.metadata.cardNumber;
    }
    if (parseResult.metadata.plateNumber) {
      updateData.detectedPlate = parseResult.metadata.plateNumber;
    }
    if (parseResult.metadata.vin) {
      updateData.detectedVin = parseResult.metadata.vin;
    }
    if (parseResult.metadata.dateFrom) {
      updateData.detectedDateFrom = parseResult.metadata.dateFrom;
    }
    if (parseResult.metadata.dateTo) {
      updateData.detectedDateTo = parseResult.metadata.dateTo;
    }
    
    // 8. Try to match driver
    const driverMatch = await matchDriver(parseResult);
    if (driverMatch) {
      updateData.driverId = driverMatch.id;
    } else if (parseResult.metadata.driverName || parseResult.metadata.cardNumber) {
      // Create new unlinked driver
      const newDriver = await createOrGetDriver(parseResult);
      if (newDriver) {
        updateData.driverId = newDriver.id;
        
        // Try auto-linking with employee
        const autoLinked = await autoLinkDriver(newDriver.id);
        if (!autoLinked) {
          await prisma.tachographIncident.create({
            data: {
              incidentType: 'UNIDENTIFIED_DRIVER',
              severity: 'MEDIUM',
              importId: importRecord.id,
              driverId: newDriver.id,
              title: `Conductor no vinculado: ${parseResult.metadata.driverName || parseResult.metadata.cardNumber}`,
              description: 'Se detectó un conductor en el archivo pero no se pudo vincular automáticamente con ningún empleado interno.',
            }
          });
          warnings.push('Conductor detectado pero no vinculado a empleado interno.');
        }
      }
    }
    
    // 9. Try to match vehicle
    const vehicleMatch = await matchVehicle(parseResult);
    if (vehicleMatch) {
      updateData.vehicleId = vehicleMatch.id;
    } else if (parseResult.metadata.plateNumber || parseResult.metadata.vin) {
      // Create new unlinked vehicle
      const newVehicle = await createOrGetVehicle(parseResult);
      if (newVehicle) {
        updateData.vehicleId = newVehicle.id;
        
        // Try auto-linking with internal vehicle
        const autoLinked = await autoLinkVehicle(newVehicle.id);
        if (!autoLinked) {
          await prisma.tachographIncident.create({
            data: {
              incidentType: 'UNIDENTIFIED_VEHICLE',
              severity: 'MEDIUM',
              importId: importRecord.id,
              vehicleId: newVehicle.id,
              title: `Vehículo no vinculado: ${parseResult.metadata.plateNumber || parseResult.metadata.vin}`,
              description: 'Se detectó un vehículo en el archivo pero no se pudo vincular automáticamente con ningún camión interno.',
            }
          });
          warnings.push('Vehículo detectado pero no vinculado a camión interno.');
        }
      }
    }
    
    // 10. Create activities (if parsed)
    if (parseResult.activities.length > 0) {
      await prisma.tachographActivity.createMany({
        data: parseResult.activities.map(act => ({
          importId: importRecord.id,
          sourceType: parseResult.fileType,
          driverId: updateData.driverId || null,
          vehicleId: updateData.vehicleId || null,
          activityType: act.activityType,
          startTime: act.startTime,
          endTime: act.endTime,
          durationMinutes: act.durationMinutes,
          countryStart: act.countryStart || null,
          countryEnd: act.countryEnd || null,
          rawPayloadJson: act.rawPayload ? JSON.stringify(act.rawPayload) : null,
          confidenceLevel: act.confidenceLevel,
        }))
      });
    }
    
    // 11. Determine final status
    const finalStatus = errors.length > 0
      ? 'ERROR'
      : warnings.length > 0
        ? 'PROCESSED_WARNINGS'
        : 'PROCESSED_OK';
    
    updateData.importStatus = finalStatus;
    updateData.warningsJson = JSON.stringify(warnings);
    updateData.errorsJson = JSON.stringify(errors);
    
    await prisma.tachographImport.update({
      where: { id: importRecord.id },
      data: updateData
    });
    
    return {
      success: true,
      importId: importRecord.id,
      status: finalStatus as any,
      warnings,
      errors,
      driverName: parseResult.metadata.driverName,
      vehiclePlate: parseResult.metadata.plateNumber,
    };
    
  } catch (error: any) {
    // Handle processing errors
    const errorMsg = error.message || 'Error desconocido durante el procesamiento';
    errors.push(errorMsg);
    
    await prisma.tachographImport.update({
      where: { id: importRecord.id },
      data: {
        importStatus: 'ERROR',
        errorsJson: JSON.stringify([errorMsg]),
        warningsJson: JSON.stringify(warnings),
        processedAt: new Date(),
      }
    });
    
    await prisma.tachographIncident.create({
      data: {
        incidentType: 'PARSE_ERROR',
        severity: 'HIGH',
        importId: importRecord.id,
        title: `Error procesando: ${fileName}`,
        description: errorMsg,
      }
    });
    
    return {
      success: false,
      importId: importRecord.id,
      status: 'ERROR',
      warnings,
      errors,
    };
  }
}

// =====================
// Driver Matching
// =====================

async function matchDriver(parseResult: TachographParseResult) {
  // Try by card number first
  if (parseResult.metadata.cardNumber) {
    const existing = await prisma.tachographDriver.findUnique({
      where: { cardNumber: parseResult.metadata.cardNumber }
    });
    if (existing) return existing;
  }
  return null;
}

async function createOrGetDriver(parseResult: TachographParseResult) {
  const { driverName, cardNumber } = parseResult.metadata;
  if (!driverName && !cardNumber) return null;
  
  // Check if exists by card
  if (cardNumber) {
    const existing = await prisma.tachographDriver.findUnique({ where: { cardNumber } });
    if (existing) return existing;
  }
  
  return prisma.tachographDriver.create({
    data: {
      fullName: driverName || 'Desconocido',
      cardNumber: cardNumber || null,
    }
  });
}

async function autoLinkDriver(driverId: number): Promise<boolean> {
  const driver = await prisma.tachographDriver.findUnique({ where: { id: driverId } });
  if (!driver || driver.linkedEmployeeId) return !!driver?.linkedEmployeeId;
  
  // ========================================
  // Strategy 1: Match by DNI in card number
  // ========================================
  // Spanish tachograph cards often embed the DNI digits.
  // Card number examples: E12805000000, EA9606492800
  // Employee DNI examples: 29028003W, 44795380M
  // We extract digits from DNI and check if the card number contains them.
  if (driver.cardNumber) {
    const allEmployees = await prisma.empleado.findMany({
      where: { activo: true, dni: { not: null } }
    });
    
    for (const emp of allEmployees) {
      if (!emp.dni) continue;
      if (dniMatchesCard(emp.dni, driver.cardNumber)) {
        await prisma.tachographDriver.update({
          where: { id: driverId },
          data: { linkedEmployeeId: emp.id }
        });
        return true;
      }
    }
  }
  
  // ========================================
  // Strategy 2: Match by name (fuzzy)
  // ========================================
  if (driver.fullName && driver.fullName !== 'Desconocido') {
    const employees = await prisma.empleado.findMany({
      where: {
        activo: true,
        OR: [
          { nombre: { contains: driver.fullName, mode: 'insensitive' } },
        ]
      }
    });
    
    if (employees.length === 1) {
      await prisma.tachographDriver.update({
        where: { id: driverId },
        data: { linkedEmployeeId: employees[0].id }
      });
      return true;
    }
  }
  
  return false;
}

// =====================
// DNI Matching Utilities
// =====================

/**
 * Normalize a Spanish DNI/NIE to just its numeric digits.
 * DNI: 8 digits + letter (e.g. 44795380M → 44795380)
 * NIE: X/Y/Z + 7 digits + letter (e.g. X1234567L → 1234567)
 */
function normalizeDni(dni: string): string {
  // Remove spaces, dashes, dots
  const clean = dni.replace(/[\s\-\.]/g, '').toUpperCase();
  // Extract only digits
  return clean.replace(/[^0-9]/g, '');
}

/**
 * Check if an employee's DNI matches a tachograph card number.
 * Spanish tachograph cards embed DNI digits within the card number.
 * We check if the card number contains the DNI digits (minimum 6 matching).
 * 
 * Examples:
 *   DNI "29028003W" → digits "29028003"
 *   Card "E29028003000" → contains "29028003" → MATCH
 *   Card "E12805000000" vs DNI "44795380M" → no match
 */
function dniMatchesCard(dni: string, cardNumber: string): boolean {
  if (!dni || !cardNumber) return false;
  
  const dniDigits = normalizeDni(dni);
  const cardClean = cardNumber.replace(/[\s\-\.]/g, '').toUpperCase();
  const cardDigits = cardClean.replace(/[^0-9]/g, '');
  
  // Need at least 6 digits from DNI to avoid false positives
  if (dniDigits.length < 6) return false;
  
  // Check if card contains the full DNI digits
  if (cardDigits.includes(dniDigits)) return true;
  
  // Check if the card number (including letters) contains the full DNI digits
  if (cardClean.includes(dniDigits)) return true;
  
  // Check with DNI letter included (e.g., "44795380M" in "E44795380M00")
  const dniWithLetter = dni.replace(/[\s\-\.]/g, '').toUpperCase();
  if (dniWithLetter.length >= 8 && cardClean.includes(dniWithLetter)) return true;
  
  return false;
}

// =====================
// Vehicle Matching
// =====================

/**
 * Normalize plate number for fuzzy matching.
 * Strips country prefixes (E, D, F, G, etc.), spaces, dashes, and uppercases.
 * Spanish plates: 4 digits + 3 letters (e.g., 9946GWZ)
 * Tachograph may prepend country code: G9946GW, E9946GWZ, etc.
 */
function normalizePlate(plate: string): string {
  // Remove spaces, dashes, dots
  let normalized = plate.replace(/[\s\-\.]/g, '').toUpperCase();
  // Extract the core Spanish plate pattern (4 digits + 2-3 letters) from anywhere in the string
  const match = normalized.match(/(\d{4}[A-Z]{2,3})/);
  if (match) return match[1];
  // If no standard pattern found, just return cleaned version
  return normalized;
}

/**
 * Check if two plates likely refer to the same vehicle
 */
function platesMatch(plate1: string, plate2: string): boolean {
  if (!plate1 || !plate2) return false;
  // Exact match
  if (plate1.toUpperCase() === plate2.toUpperCase()) return true;
  // Normalized match (strips country prefix, extracts core plate)
  const n1 = normalizePlate(plate1);
  const n2 = normalizePlate(plate2);
  if (n1 === n2) return true;
  // One contains the other (handles partial plates)
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  return false;
}

async function matchVehicle(parseResult: TachographParseResult) {
  const { plateNumber, vin } = parseResult.metadata;
  
  // 1. Exact plate match
  if (plateNumber) {
    const existing = await prisma.tachographVehicle.findUnique({
      where: { plateNumber }
    });
    if (existing) return existing;
    
    // 2. Fuzzy plate match — search all vehicles and compare normalized
    const allVehicles = await prisma.tachographVehicle.findMany({
      where: { plateNumber: { not: null } }
    });
    for (const v of allVehicles) {
      if (v.plateNumber && platesMatch(plateNumber, v.plateNumber)) {
        return v;
      }
    }
  }
  
  // 3. Exact VIN match
  if (vin) {
    const existing = await prisma.tachographVehicle.findUnique({
      where: { vin }
    });
    if (existing) return existing;
  }
  
  return null;
}

async function createOrGetVehicle(parseResult: TachographParseResult) {
  const { plateNumber, vin } = parseResult.metadata;
  if (!plateNumber && !vin) return null;
  
  // Try exact matches first
  if (plateNumber) {
    const existing = await prisma.tachographVehicle.findUnique({ where: { plateNumber } });
    if (existing) return existing;
  }
  if (vin) {
    const existing = await prisma.tachographVehicle.findUnique({ where: { vin } });
    if (existing) return existing;
  }
  
  // Try fuzzy plate match before creating new
  if (plateNumber) {
    const allVehicles = await prisma.tachographVehicle.findMany({
      where: { plateNumber: { not: null } }
    });
    for (const v of allVehicles) {
      if (v.plateNumber && platesMatch(plateNumber, v.plateNumber)) {
        return v;
      }
    }
  }
  
  return prisma.tachographVehicle.create({
    data: {
      plateNumber: plateNumber || null,
      vin: vin || null,
    }
  });
}

async function autoLinkVehicle(vehicleId: number): Promise<boolean> {
  const vehicle = await prisma.tachographVehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.linkedVehicleId) return !!vehicle?.linkedVehicleId;
  
  // Try to match by plate (exact)
  if (vehicle.plateNumber) {
    const camion = await prisma.camion.findUnique({
      where: { matricula: vehicle.plateNumber }
    });
    if (camion) {
      await prisma.tachographVehicle.update({
        where: { id: vehicleId },
        data: { linkedVehicleId: camion.id }
      });
      return true;
    }
    
    // Fuzzy match — search all camiones and compare normalized plates
    const allCamiones = await prisma.camion.findMany({
      where: { matricula: { not: '' } },
      select: { id: true, matricula: true }
    });
    for (const c of allCamiones) {
      if (c.matricula && platesMatch(vehicle.plateNumber, c.matricula)) {
        await prisma.tachographVehicle.update({
          where: { id: vehicleId },
          data: { linkedVehicleId: c.id }
        });
        return true;
      }
    }
  }
  
  // Try to match by VIN
  if (vehicle.vin) {
    const camion = await prisma.camion.findFirst({
      where: { nVin: vehicle.vin }
    });
    if (camion) {
      await prisma.tachographVehicle.update({
        where: { id: vehicleId },
        data: { linkedVehicleId: camion.id }
      });
      return true;
    }
  }
  
  return false;
}

// =====================
// Dashboard Data
// =====================

export async function getDashboardData(filters?: {
  dateFrom?: Date;
  dateTo?: Date;
  driverId?: number;
  vehicleId?: number;
}) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    importsToday,
    importsWeek,
    importsMonth,
    importsError,
    activeDrivers,
    activeVehicles,
    openIncidents,
    pendingReview,
    recentImports,
  ] = await Promise.all([
    prisma.tachographImport.count({
      where: { importDate: { gte: todayStart } }
    }),
    prisma.tachographImport.count({
      where: { importDate: { gte: weekStart } }
    }),
    prisma.tachographImport.count({
      where: { importDate: { gte: monthStart } }
    }),
    prisma.tachographImport.count({
      where: { importStatus: 'ERROR' }
    }),
    prisma.tachographDriver.count({ where: { active: true } }),
    prisma.tachographVehicle.count({ where: { active: true } }),
    prisma.tachographIncident.count({
      where: { resolutionStatus: { in: ['OPEN', 'IN_PROGRESS'] } }
    }),
    prisma.tachographImport.count({
      where: { reviewedAt: null, importStatus: { in: ['PROCESSED_OK', 'PROCESSED_WARNINGS'] } }
    }),
    prisma.tachographImport.findMany({
      take: 10,
      orderBy: { importDate: 'desc' },
      include: {
        driver: { select: { id: true, fullName: true, linkedEmployeeId: true } },
        vehicle: { select: { id: true, plateNumber: true, linkedVehicleId: true } },
      }
    }),
  ]);

  return {
    stats: {
      importsToday,
      importsWeek,
      importsMonth,
      importsError,
      activeDrivers,
      activeVehicles,
      openIncidents,
      pendingReview,
    },
    recentImports,
  };
}

// =====================
// Folder scanning
// =====================

export async function scanInputFolder(userId: number): Promise<{
  found: number;
  processed: number;
  errors: string[];
}> {
  const config = await prisma.tachographConfig.findUnique({
    where: { key: 'input_folder' }
  });
  
  if (!config || !config.value) {
    return { found: 0, processed: 0, errors: ['No hay carpeta de entrada configurada.'] };
  }
  
  const inputFolder = config.value;
  
  if (!fs.existsSync(inputFolder)) {
    return { found: 0, processed: 0, errors: [`La carpeta '${inputFolder}' no existe.`] };
  }
  
  const files = fs.readdirSync(inputFolder);
  const errors: string[] = [];
  let processed = 0;
  
  for (const file of files) {
    const filePath = path.join(inputFolder, file);
    const stat = fs.statSync(filePath);
    
    if (!stat.isFile()) continue;
    
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await processImport(buffer, file, null, userId, 'LOCAL_FOLDER');
      
      if (result.success) {
        // Move to processed folder
        const processedConfig = await prisma.tachographConfig.findUnique({ where: { key: 'processed_folder' } });
        const destFolder = processedConfig?.value || PROCESSED_DIR;
        
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }
        
        const destPath = path.join(destFolder, `${Date.now()}_${file}`);
        fs.renameSync(filePath, destPath);
        processed++;
      } else if (result.errors.some(e => e.includes('duplicado'))) {
        // Skip duplicates silently
        processed++;
      } else {
        errors.push(`Error procesando ${file}: ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      errors.push(`Error leyendo ${file}: ${error.message}`);
    }
  }
  
  return { found: files.length, processed, errors };
}
