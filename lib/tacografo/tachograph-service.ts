/**
 * TachographService v2 — Servicio principal del módulo Tacógrafo Digital
 * 
 * Pipeline v2 por capas:
 * 1. Validar archivo (extensión, tamaño)
 * 2. Calcular hash (deduplicación)
 * 3. Guardar archivo original (via StorageAdapter)
 * 4. Registrar importación + ProcessingRun en BD
 * 5. Parsear archivo → BinaryRawEvent[]
 * 6. Persistir RawEvents en BD
 * 7. Normalizar → NormalizedEventData[] (con timezone, split, 4 dimensiones)
 * 8. Matching conductor/vehículo con MatchAudit
 * 9. Persistir NormalizedEvents + MatchAudit en BD
 * 10. Crear/vincular conductor y vehículo (import-level)
 * 11. Legacy: crear TachographActivityLegacy
 * 12. Generar resúmenes diarios
 * 13. Detectar incidencias
 */

import { prisma } from '@/lib/prisma';
import { parseTachographFile, isValidTachographExtension } from './tachograph-parser';
import type { TachographParseResult, BinaryRawEvent } from './tachograph-parser';
import { normalizeRawEvents } from './tachograph-normalizer';
import type { NormalizedEventData, DailySummary, RegulationIncident } from './tachograph-normalizer';
import { getStorageAdapter } from './storage-adapter';
import crypto from 'crypto';
import path from 'path';

// =====================
// Tipos
// =====================

export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export interface ImportProcessResult {
  success: boolean;
  importId?: number;
  processingRunId?: number;
  status: 'PENDING' | 'PROCESSING' | 'PROCESSED_OK' | 'PROCESSED_WARNINGS' | 'ERROR';
  warnings: string[];
  errors: string[];
  driverName?: string;
  vehiclePlate?: string;
  rawEventsCount?: number;
  normalizedEventsCount?: number;
}

// =====================
// Constantes de versionado
// =====================

const PARSER_VERSION = 'binary-v2';
const NORMALIZATION_VERSION = 'norm-v1';
const MATCHING_VERSION = 'match-v1';
const AGGREGATION_VERSION = 'agg-v1';

// =====================
// Pipeline principal
// =====================

export async function processImport(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string | null,
  uploadedById: number,
  sourceType: 'MANUAL_UPLOAD' | 'LOCAL_FOLDER' = 'MANUAL_UPLOAD',
  processingRunId?: number
): Promise<ImportProcessResult> {
  
  const warnings: string[] = [];
  const errors: string[] = [];
  const extension = path.extname(fileName).toLowerCase();
  
  // 1. Validate extension
  if (!isValidTachographExtension(extension)) {
    warnings.push(`La extensión '${extension}' no es estándar de tacógrafo. Se procesará igualmente.`);
  }
  
  // 2. Compute hash for deduplication
  const fileHash = computeFileHash(fileBuffer);
  
  // 3. Check for duplicates
  const existing = await prisma.tachographImport.findUnique({
    where: { fileHash }
  });
  
  if (existing) {
    await prisma.tachographIncident.create({
      data: {
        incidentType: 'DUPLICATE_FILE',
        severity: 'LOW',
        importId: existing.id,
        title: `Archivo duplicado: ${fileName}`,
        description: `Se intentó importar un archivo idéntico (ID: ${existing.id}, ${existing.fileName}). Hash: ${fileHash}`,
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
  
  // 4. Save file via StorageAdapter
  const storage = getStorageAdapter();
  let savedPath: string;
  let savedProvider: string;
  
  try {
    const result = await storage.save(fileBuffer, fileName);
    savedPath = result.path;
    savedProvider = result.provider;
  } catch {
    savedPath = `unsaved:${fileName}`;
    savedProvider = 'none';
    warnings.push('El archivo no se pudo guardar en disco (entorno serverless).');
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
      rawFilePath: savedPath,
      rawFileProvider: savedProvider,
      parserVersion: PARSER_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      matchingVersion: MATCHING_VERSION,
      aggregationVersion: AGGREGATION_VERSION,
      uploadedById,
      processingRunId: processingRunId || null,
    }
  });
  
  try {
    // 6. Parse file → rawEvents + legacy activities
    const parseResult = await parseTachographFile(fileName, fileBuffer, extension);
    warnings.push(...parseResult.warnings);
    errors.push(...parseResult.errors);
    
    // 7. Update import with parsed metadata (including real parserVersion)
    const updateData: any = {
      fileType: parseResult.fileType,
      parserVersion: parseResult.parserVersion, // Use REAL parser version, not constant
      processedAt: new Date(),
      rawMetadataJson: parseResult.metadata,
      detectedDriverName: parseResult.metadata.driverName || null,
      detectedCardNumber: parseResult.metadata.cardNumber || null,
      detectedPlate: parseResult.metadata.plateNumber || null,
      detectedVin: parseResult.metadata.vin || null,
      detectedDateFrom: parseResult.metadata.dateFrom || null,
      detectedDateTo: parseResult.metadata.dateTo || null,
    };
    
    // 8. Match driver (import-level)
    const driverMatch = await matchDriver(parseResult);
    if (driverMatch) {
      updateData.driverId = driverMatch.id;
    } else if (parseResult.metadata.driverName || parseResult.metadata.cardNumber) {
      const newDriver = await createOrGetDriver(parseResult);
      if (newDriver) {
        updateData.driverId = newDriver.id;
        const autoLinked = await autoLinkDriver(newDriver.id, parseResult.metadata.driverDni);
        if (!autoLinked) {
          await prisma.tachographIncident.create({
            data: {
              incidentType: 'UNIDENTIFIED_DRIVER',
              severity: 'MEDIUM',
              importId: importRecord.id,
              driverId: newDriver.id,
              title: `Conductor no vinculado: ${parseResult.metadata.driverName || parseResult.metadata.cardNumber}`,
              description: 'Conductor detectado pero no vinculado a empleado interno.',
            }
          });
          warnings.push('Conductor detectado pero no vinculado a empleado interno.');
        }
      }
    }
    
    // 9. Match vehicle (import-level)
    const vehicleMatch = await matchVehicle(parseResult);
    if (vehicleMatch) {
      updateData.vehicleId = vehicleMatch.id;
    } else if (parseResult.metadata.plateNumber || parseResult.metadata.vin) {
      const newVehicle = await createOrGetVehicle(parseResult);
      if (newVehicle) {
        updateData.vehicleId = newVehicle.id;
        const autoLinked = await autoLinkVehicle(newVehicle.id);
        if (!autoLinked) {
          await prisma.tachographIncident.create({
            data: {
              incidentType: 'UNIDENTIFIED_VEHICLE',
              severity: 'MEDIUM',
              importId: importRecord.id,
              vehicleId: newVehicle.id,
              title: `Vehículo no vinculado: ${parseResult.metadata.plateNumber || parseResult.metadata.vin}`,
              description: 'Vehículo detectado pero no vinculado a camión interno.',
            }
          });
          warnings.push('Vehículo detectado pero no vinculado a camión interno.');
        }
      }
    }
    
    // 10. Persist RawEvents
    let rawEventIds: number[] = [];
    if (parseResult.rawEvents.length > 0) {
      const rawData = parseResult.rawEvents.map(re => ({
        importId: importRecord.id,
        sourceType: parseResult.fileType,
        rawStartAt: re.rawStartAt,
        rawEndAt: re.rawEndAt,
        rawActivityType: re.rawActivityType,
        rawDriverIdentifier: re.rawDriverIdentifier,
        rawVehicleIdentifier: re.rawVehicleIdentifier,
        rawPayloadJson: re.rawPayload as any,
        extractionMethod: re.extractionMethod,
        extractionNotes: re.extractionNotes,
        extractionStatus: re.extractionStatus,
        fingerprint: crypto.createHash('sha256').update(
          [parseResult.fileType, re.rawDriverIdentifier, re.rawVehicleIdentifier, re.rawActivityType, re.rawStartAt.toISOString(), re.rawEndAt.toISOString()].join('|')
        ).digest('hex').substring(0, 16),
      }));
      
      await prisma.tachographRawEvent.createMany({ data: rawData });
      
      // Get IDs
      const created = await prisma.tachographRawEvent.findMany({
        where: { importId: importRecord.id },
        orderBy: { rawStartAt: 'asc' },
        select: { id: true },
      });
      rawEventIds = created.map(r => r.id);
    }
    
    // 11. Normalize rawEvents → NormalizedEventData[]
    let normalizedCount = 0;
    if (parseResult.rawEvents.length > 0) {
      // Get existing fingerprints for this driver to dedup
      const existingFingerprints = new Set<string>();
      if (updateData.driverId) {
        const existingEvents = await prisma.tachographNormalizedEvent.findMany({
          where: { driverId: updateData.driverId },
          select: { startAtUtc: true, endAtUtc: true, normalizedActivityType: true, sourceType: true },
        });
        // Simple dedup based on same activity at same time
        for (const ee of existingEvents) {
          existingFingerprints.add(crypto.createHash('sha256').update(
            [ee.sourceType, '', '', ee.normalizedActivityType, ee.startAtUtc.toISOString(), ee.endAtUtc.toISOString()].join('|')
          ).digest('hex').substring(0, 16));
        }
      }
      
      const normResult = normalizeRawEvents(parseResult.rawEvents, parseResult.fileType, existingFingerprints);
      warnings.push(...normResult.warnings);
      
      // 12. Persist NormalizedEvents in BATCH (performance: single createMany instead of N creates)
      if (normResult.normalizedEvents.length > 0) {
        // Pre-compute matching info (same for all events in one file)
        const matchingMethod: string | null = updateData.driverId
          ? (parseResult.metadata.cardNumber ? 'card_number_exact' : 
             parseResult.metadata.driverDni ? 'dni_from_filename' : 
             parseResult.metadata.driverName ? 'name_fuzzy' : 'import_level')
          : null;
        
        // Build vehicle cache: rawVehicleIdentifier → vehicleId
        // This allows assigning the correct vehicle per event (a driver may use multiple trucks per day)
        const vehicleCache = new Map<string, number | null>();
        const uniquePlates = new Set<string>();
        for (const ne of normResult.normalizedEvents) {
          if (ne.rawVehicleIdentifier) uniquePlates.add(ne.rawVehicleIdentifier);
        }
        for (const plate of uniquePlates) {
          // Try to find existing TachographVehicle by plate
          const normalizedPlate = plate.replace(/[\s\-]/g, '').toUpperCase();
          let vehicle = await prisma.tachographVehicle.findFirst({
            where: { 
              OR: [
                { plateNumber: normalizedPlate },
                { plateNumber: plate },
              ]
            }
          });
          if (!vehicle) {
            // Check fuzzy match
            const allVehicles = await prisma.tachographVehicle.findMany({
              where: { plateNumber: { not: null } }
            });
            for (const v of allVehicles) {
              if (v.plateNumber && platesMatch(plate, v.plateNumber)) {
                vehicle = v;
                break;
              }
            }
          }
          if (!vehicle && normalizedPlate.length >= 4) {
            // Create new vehicle record
            vehicle = await prisma.tachographVehicle.create({
              data: { plateNumber: normalizedPlate }
            });
            await autoLinkVehicle(vehicle.id);
          }
          vehicleCache.set(plate, vehicle?.id || null);
        }
        
        // Build all normalized event data for batch insert
        const normalizedBatch = normResult.normalizedEvents.map(ne => {
          let matchingStatus = ne.matchingStatus;
          let consolidationStatus = ne.consolidationStatus;
          let consolidationReason = ne.consolidationReason;
          
          if (updateData.driverId) {
            matchingStatus = 'matched';
          }
          if (matchingStatus === 'matched' && ne.confidenceLevel !== 'low') {
            consolidationStatus = 'operative';
            consolidationReason = `Single source ${parseResult.fileType}, driver matched via ${matchingMethod}`;
          } else if (ne.confidenceLevel === 'low') {
            consolidationStatus = 'provisional';
            consolidationReason = 'Low confidence, provisional until confirmed';
          }
          
          const parentRawEventId = ne.parentRawEventIndex >= 0 && ne.parentRawEventIndex < rawEventIds.length
            ? rawEventIds[ne.parentRawEventIndex] : null;
          
          // Use per-event vehicle if available, fallback to import-level vehicle
          const eventVehicleId = ne.rawVehicleIdentifier 
            ? (vehicleCache.get(ne.rawVehicleIdentifier) ?? updateData.vehicleId ?? null)
            : (updateData.vehicleId || null);
          
          return {
            importId: importRecord.id,
            sourceType: parseResult.fileType,
            driverId: updateData.driverId || null,
            vehicleId: eventVehicleId,
            startAtUtc: ne.startAtUtc,
            endAtUtc: ne.endAtUtc,
            startAtLocal: ne.startAtLocal,
            endAtLocal: ne.endAtLocal,
            operationalDayLocal: ne.operationalDayLocal,
            normalizedActivityType: ne.normalizedActivityType,
            durationMinutes: ne.durationMinutes,
            extractionMethod: ne.extractionMethod,
            confidenceLevel: ne.confidenceLevel,
            matchingStatus,
            consolidationStatus,
            consolidationReason,
            matchingMethod,
            isSplitCrossMidnight: ne.isSplitCrossMidnight,
            parentRawEventId,
          };
        });
        
        // Batch insert all normalized events at once
        await prisma.tachographNormalizedEvent.createMany({ data: normalizedBatch });
        normalizedCount = normalizedBatch.length;
        
        // 12b. Create MatchAudit entries in BATCH
        if (updateData.driverId || updateData.vehicleId) {
          // Get created event IDs for MatchAudit references
          const createdEvents = await prisma.tachographNormalizedEvent.findMany({
            where: { importId: importRecord.id },
            orderBy: { startAtUtc: 'asc' },
            select: { id: true },
          });
          
          const matchAuditBatch: any[] = [];
          
          // Pre-fetch labels once (not per event!)
          let driverLabel = 'Unknown';
          let vehicleLabel = 'Unknown';
          if (updateData.driverId) {
            const driver = await prisma.tachographDriver.findUnique({ 
              where: { id: updateData.driverId }, select: { fullName: true } 
            });
            driverLabel = driver?.fullName || 'Unknown';
          }
          if (updateData.vehicleId) {
            const vehicle = await prisma.tachographVehicle.findUnique({ 
              where: { id: updateData.vehicleId }, select: { plateNumber: true } 
            });
            vehicleLabel = vehicle?.plateNumber || 'Unknown';
          }
          
          for (const evt of createdEvents) {
            if (updateData.driverId) {
              matchAuditBatch.push({
                normalizedEventId: evt.id,
                entityType: 'DRIVER',
                candidateId: updateData.driverId,
                candidateLabel: driverLabel,
                method: matchingMethod || 'import_level',
                score: matchingMethod === 'card_number_exact' ? 1.0 : 
                       matchingMethod === 'dni_from_filename' ? 0.95 :
                       matchingMethod === 'name_fuzzy' ? 0.7 : 0.5,
                reason: `Driver matched via ${matchingMethod || 'import_level association'}`,
                decision: 'ACCEPTED',
                isAutomatic: true,
              });
            }
            if (updateData.vehicleId) {
              matchAuditBatch.push({
                normalizedEventId: evt.id,
                entityType: 'VEHICLE',
                candidateId: updateData.vehicleId,
                candidateLabel: vehicleLabel,
                method: parseResult.metadata.plateNumber ? 'plate_exact' : 
                       parseResult.metadata.vin ? 'vin_exact' : 'import_level',
                score: parseResult.metadata.vin ? 1.0 : 
                       parseResult.metadata.plateNumber ? 0.9 : 0.5,
                reason: `Vehicle matched via ${parseResult.metadata.vin ? 'VIN' : parseResult.metadata.plateNumber ? 'plate' : 'import association'}`,
                decision: 'ACCEPTED',
                isAutomatic: true,
              });
            }
          }
          
          // Batch insert all MatchAudit entries at once
          if (matchAuditBatch.length > 0) {
            await prisma.tachographMatchAudit.createMany({ data: matchAuditBatch });
          }
        }
        
        // 13. Generate/update daily summaries (batch upsert)
        if (updateData.driverId && normResult.dailySummaries.length > 0) {
          // Get existing summaries for this driver in one query
          const summaryDates = normResult.dailySummaries.map(s => new Date(s.date + 'T00:00:00Z'));
          const existingSummaries = await prisma.tachographDailySummary.findMany({
            where: {
              driverId: updateData.driverId,
              date: { in: summaryDates },
            }
          });
          const existingMap = new Map(existingSummaries.map(s => [s.date.toISOString(), s]));
          
          const toCreate: any[] = [];
          for (const summary of normResult.dailySummaries) {
            const summaryDate = new Date(summary.date + 'T00:00:00Z');
            const existing = existingMap.get(summaryDate.toISOString());

            const coverageFields = {
              ownSourceMinutes: summary.ownSourceMinutes,
              inheritedSplitMinutes: summary.inheritedSplitMinutes,
              rawEventsCount: summary.rawEventsCount,
              calendarCoverageRatio: summary.calendarCoverageRatio,
              dayConsolidationStatus: summary.dayConsolidationStatus,
            };

            if (existing) {
              await prisma.tachographDailySummary.update({
                where: { id: existing.id },
                data: {
                  totalDrivingMinutes: summary.totalDrivingMinutes,
                  totalOtherWorkMinutes: summary.totalOtherWorkMinutes,
                  totalAvailabilityMinutes: summary.totalAvailabilityMinutes,
                  totalRestMinutes: summary.totalRestMinutes,
                  totalBreakMinutes: summary.totalBreakMinutes,
                  gapMinutes: summary.gapMinutes,
                  importedFromCount: { increment: 1 },
                  consistencyStatus: summary.consistencyStatus,
                  sourceDataOrigin: summary.sourceDataOrigin,
                  averageConfidence: summary.averageConfidence,
                  ...coverageFields,
                }
              });
            } else {
              toCreate.push({
                driverId: updateData.driverId,
                vehicleId: updateData.vehicleId || null,
                date: summaryDate,
                totalDrivingMinutes: summary.totalDrivingMinutes,
                totalOtherWorkMinutes: summary.totalOtherWorkMinutes,
                totalAvailabilityMinutes: summary.totalAvailabilityMinutes,
                totalRestMinutes: summary.totalRestMinutes,
                totalBreakMinutes: summary.totalBreakMinutes,
                gapMinutes: summary.gapMinutes,
                importedFromCount: summary.importedFromCount,
                consistencyStatus: summary.consistencyStatus,
                sourceDataOrigin: summary.sourceDataOrigin,
                averageConfidence: summary.averageConfidence,
                ...coverageFields,
              });
            }
          }
          if (toCreate.length > 0) {
            await prisma.tachographDailySummary.createMany({ data: toCreate });
          }

          // 13b. External contrast layer (post-consolidation, does NOT alter dayConsolidationStatus)
          for (const summary of normResult.dailySummaries) {
            if (summary.dayConsolidationStatus !== 'BLOCKED_NO_SOURCE') continue;
            const summaryDate = new Date(summary.date + 'T00:00:00Z');
            try {
              // Check for internal work evidence (fichajes/schedules)
              const fichajes: any[] = await (prisma.$queryRawUnsafe(
                `SELECT id FROM "Fichaje" WHERE "empleadoId" = $1 AND DATE("fecha") = $2 LIMIT 5`,
                updateData.driverId,
                summary.date,
              ) as Promise<any[]>).catch(() => []);

              if (fichajes.length > 0) {
                // External evidence found — update notes + consistencyStatus but NOT dayConsolidationStatus
                await prisma.tachographDailySummary.updateMany({
                  where: {
                    driverId: updateData.driverId,
                    date: summaryDate,
                  },
                  data: {
                    consistencyStatus: 'conflict',
                    notes: JSON.stringify({
                      externalContrast: {
                        source: 'fichaje',
                        hasWorkEvidence: true,
                        fichajesCount: fichajes.length,
                        details: 'Información tacográfica incompleta — evidencia de jornada laboral en sistema interno',
                      }
                    }),
                  },
                });
              }
            } catch {
              // Fichaje table may not exist, silently ignore
            }
          }
        }

        // 14. Create regulation incidents in batch
        if (normResult.incidents.length > 0 && updateData.driverId) {
          await prisma.tachographIncident.createMany({
            data: normResult.incidents.map(incident => ({
              incidentType: incident.type as any,
              severity: incident.severity as any,
              importId: importRecord.id,
              driverId: updateData.driverId,
              title: incident.title,
              description: incident.description,
            }))
          });
          warnings.push(`Se detectaron ${normResult.incidents.length} incidencia(s) de regulación.`);
        }
      }
    }
    
    // 15. Legacy: create TachographActivityLegacy
    if (parseResult.activities.length > 0) {
      await prisma.tachographActivityLegacy.createMany({
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
    
    // 16. Determine final status
    const finalStatus = errors.length > 0
      ? 'ERROR'
      : warnings.length > 0
        ? 'PROCESSED_WARNINGS'
        : 'PROCESSED_OK';
    
    updateData.importStatus = finalStatus;
    updateData.warningsJson = warnings;
    updateData.errorsJson = errors;
    
    await prisma.tachographImport.update({
      where: { id: importRecord.id },
      data: updateData
    });
    
    return {
      success: true,
      importId: importRecord.id,
      processingRunId,
      status: finalStatus as any,
      warnings,
      errors,
      driverName: parseResult.metadata.driverName,
      vehiclePlate: parseResult.metadata.plateNumber,
      rawEventsCount: parseResult.rawEvents.length,
      normalizedEventsCount: normalizedCount,
    };
    
  } catch (error: any) {
    const errorMsg = error.message || 'Error desconocido durante el procesamiento';
    errors.push(errorMsg);
    
    await prisma.tachographImport.update({
      where: { id: importRecord.id },
      data: {
        importStatus: 'ERROR',
        errorsJson: [errorMsg],
        warningsJson: warnings,
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
// Batch Processing
// =====================

export async function processBatch(
  files: { buffer: Buffer; fileName: string; mimeType: string | null }[],
  uploadedById: number,
  runType: 'IMPORT_BATCH' | 'REPROCESS' = 'IMPORT_BATCH'
): Promise<{ runId: number; results: ImportProcessResult[] }> {
  // Create processing run
  const run = await prisma.tachographProcessingRun.create({
    data: {
      runType,
      status: 'RUNNING',
      triggeredById: uploadedById,
      parserVersion: PARSER_VERSION,
      normalizationVersion: NORMALIZATION_VERSION,
      matchingVersion: MATCHING_VERSION,
      aggregationVersion: AGGREGATION_VERSION,
      totalFiles: files.length,
    }
  });
  
  const results: ImportProcessResult[] = [];
  let processed = 0;
  let errorCount = 0;
  
  for (const file of files) {
    const result = await processImport(
      file.buffer,
      file.fileName,
      file.mimeType,
      uploadedById,
      'MANUAL_UPLOAD',
      run.id
    );
    results.push(result);
    
    if (result.success) {
      processed++;
    } else {
      errorCount++;
    }
    
    await prisma.tachographProcessingRun.update({
      where: { id: run.id },
      data: { processedFiles: processed, errorFiles: errorCount }
    });
  }
  
  await prisma.tachographProcessingRun.update({
    where: { id: run.id },
    data: {
      status: errorCount === files.length ? 'FAILED' : errorCount > 0 ? 'PARTIAL' : 'COMPLETED',
      completedAt: new Date(),
    }
  });
  
  return { runId: run.id, results };
}

// =====================
// Driver Matching
// =====================

async function matchDriver(parseResult: TachographParseResult) {
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

async function autoLinkDriver(driverId: number, dniFromFile?: string): Promise<boolean> {
  const driver = await prisma.tachographDriver.findUnique({ where: { id: driverId } });
  if (!driver || driver.linkedEmployeeId) return !!driver?.linkedEmployeeId;
  
  // Strategy 0: Direct DNI match from filename
  if (dniFromFile) {
    const normalizedFileDni = dniFromFile.replace(/[\s\-\.]/g, '').toUpperCase();
    const allEmployees = await prisma.empleado.findMany({
      where: { activo: true, dni: { not: null } }
    });
    for (const emp of allEmployees) {
      if (!emp.dni) continue;
      const empDni = emp.dni.replace(/[\s\-\.]/g, '').toUpperCase();
      if (empDni === normalizedFileDni) {
        const empFullName = [emp.nombre, emp.apellidos].filter(Boolean).join(' ').trim();
        await prisma.tachographDriver.update({
          where: { id: driverId },
          data: { 
            linkedEmployeeId: emp.id,
            ...(driver.fullName === 'Desconocido' && empFullName ? { fullName: empFullName } : {}),
          }
        });
        return true;
      }
    }
  }
  
  // Strategy 1: Match by DNI in card number
  if (driver.cardNumber) {
    const allEmployees = await prisma.empleado.findMany({
      where: { activo: true, dni: { not: null } }
    });
    
    for (const emp of allEmployees) {
      if (!emp.dni) continue;
      if (dniMatchesCard(emp.dni, driver.cardNumber)) {
        const empFullName = [emp.nombre, emp.apellidos].filter(Boolean).join(' ').trim();
        await prisma.tachographDriver.update({
          where: { id: driverId },
          data: { 
            linkedEmployeeId: emp.id,
            ...(driver.fullName === 'Desconocido' && empFullName ? { fullName: empFullName } : {}),
          }
        });
        return true;
      }
    }
  }
  
  // Strategy 2: Match by name (fuzzy)
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
      const emp = employees[0];
      const empFullName = [emp.nombre, emp.apellidos].filter(Boolean).join(' ').trim();
      await prisma.tachographDriver.update({
        where: { id: driverId },
        data: { 
          linkedEmployeeId: emp.id,
          ...(driver.fullName === 'Desconocido' && empFullName ? { fullName: empFullName } : {}),
        }
      });
      return true;
    }
  }
  
  return false;
}

// =====================
// DNI Matching Utilities
// =====================

function normalizeDni(dni: string): string {
  const clean = dni.replace(/[\s\-\.]/g, '').toUpperCase();
  return clean.replace(/[^0-9]/g, '');
}

function dniMatchesCard(dni: string, cardNumber: string): boolean {
  if (!dni || !cardNumber) return false;
  
  const dniDigits = normalizeDni(dni);
  const cardClean = cardNumber.replace(/[\s\-\.]/g, '').toUpperCase();
  const cardDigits = cardClean.replace(/[^0-9]/g, '');
  
  if (dniDigits.length < 6) return false;
  
  if (cardDigits.includes(dniDigits)) return true;
  if (cardClean.includes(dniDigits)) return true;
  
  const dniWithLetter = dni.replace(/[\s\-\.]/g, '').toUpperCase();
  if (dniWithLetter.length >= 8 && cardClean.includes(dniWithLetter)) return true;
  
  return false;
}

// =====================
// Vehicle Matching
// =====================

function normalizePlate(plate: string): string {
  let normalized = plate.replace(/[\s\-\.]/g, '').toUpperCase();
  const match = normalized.match(/(\d{4}[A-Z]{2,3})/);
  if (match) return match[1];
  return normalized;
}

function platesMatch(plate1: string, plate2: string): boolean {
  if (!plate1 || !plate2) return false;
  if (plate1.toUpperCase() === plate2.toUpperCase()) return true;
  const n1 = normalizePlate(plate1);
  const n2 = normalizePlate(plate2);
  if (n1 === n2) return true;
  if (n1.length >= 4 && n2.length >= 4) {
    if (n1.includes(n2) || n2.includes(n1)) return true;
  }
  return false;
}

async function matchVehicle(parseResult: TachographParseResult) {
  const { plateNumber, vin } = parseResult.metadata;
  
  if (plateNumber) {
    const existing = await prisma.tachographVehicle.findUnique({
      where: { plateNumber }
    });
    if (existing) return existing;
    
    const allVehicles = await prisma.tachographVehicle.findMany({
      where: { plateNumber: { not: null } }
    });
    for (const v of allVehicles) {
      if (v.plateNumber && platesMatch(plateNumber, v.plateNumber)) {
        return v;
      }
    }
  }
  
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
  
  if (plateNumber) {
    const existing = await prisma.tachographVehicle.findUnique({ where: { plateNumber } });
    if (existing) return existing;
  }
  if (vin) {
    const existing = await prisma.tachographVehicle.findUnique({ where: { vin } });
    if (existing) return existing;
  }
  
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
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
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
  const fs = require('fs');
  
  if (!fs.existsSync(inputFolder)) {
    return { found: 0, processed: 0, errors: [`La carpeta '${inputFolder}' no existe.`] };
  }
  
  const files = fs.readdirSync(inputFolder) as string[];
  const fileData = files
    .filter((f: string) => fs.statSync(path.join(inputFolder, f)).isFile())
    .map((f: string) => ({
      buffer: fs.readFileSync(path.join(inputFolder, f)) as Buffer,
      fileName: f,
      mimeType: null as string | null,
    }));
  
  const { results } = await processBatch(fileData, userId, 'IMPORT_BATCH');
  
  const errors: string[] = [];
  let processed = 0;
  
  for (const result of results) {
    if (result.success) {
      processed++;
    } else if (!result.errors.some(e => e.includes('duplicado'))) {
      errors.push(result.errors.join(', '));
    } else {
      processed++;
    }
  }
  
  return { found: files.length, processed, errors };
}
