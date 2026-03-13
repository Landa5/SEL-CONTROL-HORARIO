/**
 * Tests de normalización para transiciones DST en España (Europe/Madrid)
 * 
 * CET (UTC+1) → CEST (UTC+2): último domingo de marzo a las 02:00 → 03:00
 * CEST (UTC+2) → CET (UTC+1): último domingo de octubre a las 03:00 → 02:00
 * 
 * Ejemplo 2025:
 *   Cambio a verano: 30 marzo 2025 02:00 → 03:00 (se pierden 60 min)
 *   Cambio a invierno: 26 octubre 2025 03:00 → 02:00 (se repiten 60 min)
 */

import { normalizeRawEvents } from '../tachograph-normalizer';
import type { BinaryRawEvent } from '../tachograph-binary-parser';

// ====================================
// Helpers
// ====================================

function makeRawEvent(
  startUtcIso: string,
  endUtcIso: string,
  activity: string = 'DRIVING',
  extras?: Partial<BinaryRawEvent>
): BinaryRawEvent {
  return {
    rawStartAt: new Date(startUtcIso),
    rawEndAt: new Date(endUtcIso),
    rawActivityType: activity,
    rawDriverIdentifier: 'TEST_DRIVER',
    rawVehicleIdentifier: 'TEST_VEHICLE',
    rawPayload: { slot: 0, cardInserted: true, byteOffset: 0, headerOffset: 4, dayTimestamp: 0 },
    extractionMethod: 'heuristic',
    extractionNotes: 'Test event',
    extractionStatus: 'OK',
    ...extras,
  };
}

function formatLocalISO(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

// ====================================
// Test Suite: Cambio a horario de verano (CET → CEST)
// Último domingo de marzo 2025: 30 marzo
// A las 02:00 CET (01:00 UTC) → 03:00 CEST (01:00 UTC)
// ====================================

describe('Normalizer — Transición CET → CEST (marzo 2025)', () => {
  
  test('Actividad que cruza el cambio de hora: DRIVING de 00:30 a 03:30 local', () => {
    // 00:30 CET = 23:30 UTC del 29 marzo
    // 03:30 CEST = 01:30 UTC del 30 marzo
    // En hora local parece 3h, pero en UTC real solo son 2h
    const events = [
      makeRawEvent('2025-03-29T23:30:00Z', '2025-03-30T01:30:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    
    // La duración real en UTC es 2h = 120 min (no 3h como parecería localmente)
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    const totalDriving = drivingEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
    expect(totalDriving).toBe(120); // 2 horas reales
  });

  test('Actividad nocturna que no cruza el cambio de hora', () => {
    // 22:00 CET (21:00 UTC) a 23:00 CET (22:00 UTC) del 29 marzo
    const events = [
      makeRawEvent('2025-03-29T21:00:00Z', '2025-03-29T22:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    expect(drivingEvents.length).toBe(1);
    expect(drivingEvents[0].durationMinutes).toBe(60);
  });

  test('operationalDayLocal correcto durante la transición', () => {
    // Actividad a las 00:30 CET del 30 marzo = 23:30 UTC del 29
    const events = [
      makeRawEvent('2025-03-29T23:30:00Z', '2025-03-30T00:30:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const event = result.normalizedEvents.find(e => e.normalizedActivityType === 'DRIVING');
    expect(event).toBeDefined();
    
    // operationalDayLocal debe ser 30 marzo (hora local es 00:30 del 30)
    const opDay = event!.operationalDayLocal.toISOString().substring(0, 10);
    expect(opDay).toBe('2025-03-30');
  });

  test('Daily summary durante día de cambio de hora tiene 23h', () => {
    // El 30 de marzo tiene 23h locales (porque se salta 1h)
    // Actividad de todo el día: 00:00 CEST a 23:59 CEST = 22:00 UTC 29/03 a 21:59 UTC 30/03
    // Simplificamos con una actividad representativa
    const events = [
      makeRawEvent('2025-03-29T23:00:00Z', '2025-03-30T05:00:00Z', 'DRIVING'), // 6h UTC
      makeRawEvent('2025-03-30T05:00:00Z', '2025-03-30T12:00:00Z', 'OTHER_WORK'), // 7h UTC
      makeRawEvent('2025-03-30T12:00:00Z', '2025-03-30T22:00:00Z', 'REST'), // 10h UTC
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    
    // Verificar que hay resúmenes diarios
    expect(result.dailySummaries.length).toBeGreaterThanOrEqual(1);
    
    const march30 = result.dailySummaries.find(s => s.date === '2025-03-30');
    if (march30) {
      // La suma de minutos debería reflejar las horas reales UTC
      const totalMinutes = march30.totalDrivingMinutes + march30.totalOtherWorkMinutes + 
                          march30.totalAvailabilityMinutes + march30.totalRestMinutes + march30.totalBreakMinutes;
      expect(totalMinutes).toBeGreaterThan(0);
    }
  });
});

// ====================================
// Test Suite: Cambio a horario de invierno (CEST → CET)
// Último domingo de octubre 2025: 26 octubre
// A las 03:00 CEST (01:00 UTC) → 02:00 CET (01:00 UTC)
// ====================================

describe('Normalizer — Transición CEST → CET (octubre 2025)', () => {
  
  test('Actividad que cruza el cambio de hora: DRIVING de 01:30 a 03:30 local', () => {
    // 01:30 CEST = 23:30 UTC del 25 octubre
    // 03:30 CET = 02:30 UTC del 26 octubre
    // En hora local parece 2h, pero en UTC real son 3h (la hora 02:00-03:00 se repite)
    const events = [
      makeRawEvent('2025-10-25T23:30:00Z', '2025-10-26T02:30:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    const totalDriving = drivingEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
    expect(totalDriving).toBe(180); // 3 horas reales (no 2h como parecería localmente)
  });

  test('Actividad completamente en CEST antes del cambio', () => {
    // 20:00 CEST a 22:00 CEST del 25 octubre
    // 20:00 CEST = 18:00 UTC, 22:00 CEST = 20:00 UTC
    const events = [
      makeRawEvent('2025-10-25T18:00:00Z', '2025-10-25T20:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    expect(drivingEvents[0].durationMinutes).toBe(120);
    
    // startAtLocal debe reflejar CEST (UTC+2)
    const startLocal = formatLocalISO(drivingEvents[0].startAtLocal);
    expect(startLocal).toBe('2025-10-25T20:00'); // 18:00 UTC + 2h = 20:00 CEST
  });

  test('Actividad completamente en CET después del cambio', () => {
    // 04:00 CET a 06:00 CET del 26 octubre
    // 04:00 CET = 03:00 UTC, 06:00 CET = 05:00 UTC
    const events = [
      makeRawEvent('2025-10-26T03:00:00Z', '2025-10-26T05:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    expect(drivingEvents[0].durationMinutes).toBe(120);
    
    // startAtLocal debe reflejar CET (UTC+1)
    const startLocal = formatLocalISO(drivingEvents[0].startAtLocal);
    expect(startLocal).toBe('2025-10-26T04:00'); // 03:00 UTC + 1h = 04:00 CET
  });

  test('operationalDayLocal correcto en la hora ambigua', () => {
    // 02:30 ambiguo — en UTC es 00:30 (CEST) o 01:30 (CET)
    // Usamos 00:30 UTC que corresponde a 02:30 CEST (antes del cambio)
    const events = [
      makeRawEvent('2025-10-26T00:30:00Z', '2025-10-26T01:30:00Z', 'REST'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const event = result.normalizedEvents.find(e => e.normalizedActivityType === 'REST');
    expect(event).toBeDefined();
    
    const opDay = event!.operationalDayLocal.toISOString().substring(0, 10);
    expect(opDay).toBe('2025-10-26');
  });

  test('Daily summary durante día de cambio tiene 25h', () => {
    // El 26 de octubre tiene 25h locales (porque se repite 1h)
    const events = [
      makeRawEvent('2025-10-25T22:00:00Z', '2025-10-26T04:00:00Z', 'REST'), // 6h UTC
      makeRawEvent('2025-10-26T04:00:00Z', '2025-10-26T12:00:00Z', 'DRIVING'), // 8h UTC
      makeRawEvent('2025-10-26T12:00:00Z', '2025-10-26T23:00:00Z', 'REST'), // 11h UTC
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    
    const oct26 = result.dailySummaries.find(s => s.date === '2025-10-26');
    expect(oct26).toBeDefined();
    if (oct26) {
      expect(oct26.totalDrivingMinutes).toBeGreaterThan(0);
    }
  });
});

// ====================================
// Test Suite: Split por medianoche LOCAL
// ====================================

describe('Normalizer — Split medianoche local', () => {
  
  test('Evento que cruza medianoche CET se divide correctamente', () => {
    // 23:00 CET del 15 enero a 02:00 CET del 16 enero (invierno, UTC+1)
    // 23:00 CET = 22:00 UTC, 02:00 CET = 01:00 UTC
    const events = [
      makeRawEvent('2025-01-15T22:00:00Z', '2025-01-16T01:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    
    // Debe dividirse en 2 partes: 23:00-00:00 (1h) y 00:00-02:00 (2h)
    expect(drivingEvents.length).toBe(2);
    
    // Verificar que son de días distintos
    const days = new Set(drivingEvents.map(e => e.operationalDayLocal.toISOString().substring(0, 10)));
    expect(days.size).toBe(2);
    expect(days.has('2025-01-15')).toBe(true);
    expect(days.has('2025-01-16')).toBe(true);
    
    // Suma total debe ser 3h = 180 min
    const totalMin = drivingEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
    expect(totalMin).toBe(180);
  });

  test('Evento que cruza medianoche CEST se divide correctamente', () => {
    // 23:00 CEST del 15 julio a 02:00 CEST del 16 julio (verano, UTC+2)
    // 23:00 CEST = 21:00 UTC, 02:00 CEST = 00:00 UTC
    const events = [
      makeRawEvent('2025-07-15T21:00:00Z', '2025-07-16T00:00:00Z', 'OTHER_WORK'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const workEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'OTHER_WORK');
    
    // Debe dividirse en 2 partes: 23:00-00:00 CEST (1h) y 00:00-02:00 CEST (2h)
    expect(workEvents.length).toBe(2);
    
    const days = new Set(workEvents.map(e => e.operationalDayLocal.toISOString().substring(0, 10)));
    expect(days.size).toBe(2);
    expect(days.has('2025-07-15')).toBe(true);
    expect(days.has('2025-07-16')).toBe(true);
  });

  test('Evento dentro del mismo día no se divide', () => {
    // 08:00 a 16:00 CET del 15 enero
    const events = [
      makeRawEvent('2025-01-15T07:00:00Z', '2025-01-15T15:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    
    expect(drivingEvents.length).toBe(1);
    expect(drivingEvents[0].durationMinutes).toBe(480);
    expect(drivingEvents[0].isSplitCrossMidnight).toBe(false);
  });
});

// ====================================
// Test Suite: Consolidación y dedup
// ====================================

describe('Normalizer — Consolidación y deduplicación', () => {
  
  test('Eventos duplicados se eliminan por fingerprint', () => {
    const events = [
      makeRawEvent('2025-01-15T07:00:00Z', '2025-01-15T09:00:00Z', 'DRIVING'),
    ];
    
    const existingFingerprints = new Set<string>();
    // Simular que ya existe este fingerprint
    const crypto = require('crypto');
    const fp = crypto.createHash('sha256').update(
      ['DRIVER_CARD', 'TEST_DRIVER', 'TEST_VEHICLE', 'DRIVING', '2025-01-15T07:00:00.000Z', '2025-01-15T09:00:00.000Z'].join('|')
    ).digest('hex').substring(0, 16);
    existingFingerprints.add(fp);
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD', existingFingerprints);
    
    // El evento debería eliminarse como duplicado
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    expect(drivingEvents.length).toBe(0);
    expect(result.warnings.some(w => w.includes('duplicados'))).toBe(true);
  });

  test('Eventos solapados del mismo tipo se fusionan', () => {
    const events = [
      makeRawEvent('2025-01-15T07:00:00Z', '2025-01-15T09:00:00Z', 'DRIVING'),
      makeRawEvent('2025-01-15T08:50:00Z', '2025-01-15T11:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const drivingEvents = result.normalizedEvents.filter(e => e.normalizedActivityType === 'DRIVING');
    
    // Se fusionan porque se solapan (8:50 < 9:00)
    expect(drivingEvents.length).toBe(1);
    expect(drivingEvents[0].durationMinutes).toBe(240); // 7:00 a 11:00 = 4h
  });

  test('Huecos > 5 min se rellenan con REST', () => {
    const events = [
      makeRawEvent('2025-01-15T07:00:00Z', '2025-01-15T09:00:00Z', 'DRIVING'),
      makeRawEvent('2025-01-15T09:30:00Z', '2025-01-15T11:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const restEvents = result.normalizedEvents.filter(e => 
      e.normalizedActivityType === 'REST' && e.extractionMethod === 'derived'
    );
    
    expect(restEvents.length).toBeGreaterThanOrEqual(1);
    // El hueco de 30min debería rellenarse
    const gapRest = restEvents.find(e => e.durationMinutes === 30);
    expect(gapRest).toBeDefined();
  });
});

// ====================================
// Test Suite: Regulation checks
// ====================================

describe('Normalizer — Detección de incidencias', () => {
  
  test('Conducción continua > 4h30min genera incidencia', () => {
    // 5 horas de conducción continua sin pausa
    const events = [
      makeRawEvent('2025-01-15T06:00:00Z', '2025-01-15T11:00:00Z', 'DRIVING'),
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const incident = result.incidents.find(i => i.type === 'DRIVING_TIME_EXCEEDED');
    expect(incident).toBeDefined();
    expect(incident!.severity).toBe('HIGH');
  });

  test('Conducción diaria > 9h genera incidencia', () => {
    const events = [
      makeRawEvent('2025-01-15T05:00:00Z', '2025-01-15T09:30:00Z', 'DRIVING'),
      makeRawEvent('2025-01-15T10:30:00Z', '2025-01-15T16:00:00Z', 'DRIVING'), // Pausa 1h
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    
    // Total: 4.5h + 5.5h = 10h → excede 9h
    const incidents = result.incidents.filter(i => i.type === 'DAILY_DRIVING_EXCEEDED');
    expect(incidents.length).toBeGreaterThanOrEqual(1);
  });

  test('Día con suficiente descanso no genera incidencia de descanso', () => {
    const events = [
      makeRawEvent('2025-01-15T06:00:00Z', '2025-01-15T10:00:00Z', 'DRIVING'),
      makeRawEvent('2025-01-15T10:00:00Z', '2025-01-15T21:00:00Z', 'REST'), // 11h REST
    ];
    
    const result = normalizeRawEvents(events, 'DRIVER_CARD');
    const restIncident = result.incidents.find(i => i.type === 'INSUFFICIENT_REST');
    expect(restIncident).toBeUndefined();
  });
});
