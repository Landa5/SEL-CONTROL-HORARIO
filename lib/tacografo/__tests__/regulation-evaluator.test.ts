/**
 * Tests unitarios para regulation-evaluator.ts
 * 
 * Cubre las 4 reglas Fase 1A del CE 561/2006:
 * - BREAK_AFTER_4H30
 * - DAILY_DRIVING_LIMIT (contextualizado en semana)
 * - WEEKLY_DRIVING_LIMIT
 * - FORTNIGHT_DRIVING_LIMIT
 */

import {
  evaluateBreakAfter4H30,
  evaluateDailyDrivingLimit,
  evaluateWeeklyDrivingLimit,
  evaluateFortnightDrivingLimit,
  type NormalizedEventForEval,
  type DaySummaryForEval,
} from '../regulation/regulation-evaluator';
import { assessEvaluability } from '../regulation/regulation-confidence';

// ====================================
// Helpers para crear datos de test
// ====================================

let nextId = 1;

function makeEvent(
  type: string,
  dayStr: string,
  startMin: number,
  durationMin: number,
  overrides?: Partial<NormalizedEventForEval>,
): NormalizedEventForEval {
  const dayDate = new Date(dayStr + 'T00:00:00Z');
  const start = new Date(dayDate.getTime() + startMin * 60000);
  const end = new Date(start.getTime() + durationMin * 60000);
  
  return {
    id: nextId++,
    startAtUtc: start,
    endAtUtc: end,
    operationalDayLocal: dayDate,
    normalizedActivityType: type,
    durationMinutes: durationMin,
    consolidationStatus: 'operative',
    confidenceLevel: 'medium',
    ...overrides,
  };
}

function makeSummary(
  date: string,
  drivingMin: number,
  status: string = 'VALID',
  confidence: string = 'medium',
): DaySummaryForEval {
  return {
    date,
    totalDrivingMinutes: drivingMin,
    dayConsolidationStatus: status,
    averageConfidence: confidence,
    calendarCoverageRatio: 0.9,
  };
}

beforeEach(() => {
  nextId = 1;
});

// ====================================
// 1. BREAK_AFTER_4H30
// ====================================

describe('BREAK_AFTER_4H30', () => {
  test('conducción continua 5h sin pausa → NON_COMPLIANT', () => {
    const events = [
      makeEvent('DRIVING', '2025-11-01', 0, 300), // 5h continuas
    ];

    const findings = evaluateBreakAfter4H30(events);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(300);
    expect(violations[0].minutesExceeded).toBe(30); // 300 - 270
    expect(violations[0].ruleCode).toBe('BREAK_AFTER_4H30');
  });

  test('conducción 4h + pausa 45min + 3h → COMPLIANT', () => {
    const events = [
      makeEvent('DRIVING', '2025-11-01', 0, 240),   // 4h
      makeEvent('REST', '2025-11-01', 240, 45),       // 45min pausa
      makeEvent('DRIVING', '2025-11-01', 285, 180),  // 3h
    ];

    const findings = evaluateBreakAfter4H30(events);
    const compliant = findings.filter(f => f.result === 'COMPLIANT');
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(0);
    expect(compliant.length).toBeGreaterThanOrEqual(1);
  });

  test('pausa split 15+30 correcta → COMPLIANT', () => {
    const events = [
      makeEvent('DRIVING', '2025-11-01', 0, 120),   // 2h
      makeEvent('BREAK', '2025-11-01', 120, 15),     // 15min primera parte
      makeEvent('DRIVING', '2025-11-01', 135, 120),  // 2h
      makeEvent('BREAK', '2025-11-01', 255, 30),     // 30min segunda parte
      makeEvent('DRIVING', '2025-11-01', 285, 60),   // 1h
    ];

    const findings = evaluateBreakAfter4H30(events);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(0);
  });

  test('OTHER_WORK NO interrumpe conducción continua', () => {
    const events = [
      makeEvent('DRIVING', '2025-11-01', 0, 150),     // 2h30
      makeEvent('OTHER_WORK', '2025-11-01', 150, 30),  // 30min other work
      makeEvent('DRIVING', '2025-11-01', 180, 150),    // 2h30 → total 5h
    ];

    const findings = evaluateBreakAfter4H30(events);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    // 5h de conducción continua (OTHER_WORK no la interrumpe)
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(300);
  });
});

// ====================================
// 2. DAILY_DRIVING_LIMIT
// ====================================

describe('DAILY_DRIVING_LIMIT', () => {
  test('día 8h conducción → COMPLIANT', () => {
    const summaries = [makeSummary('2025-11-03', 480)]; // Lunes, 8h
    const events = [makeEvent('DRIVING', '2025-11-03', 0, 480)];

    const findings = evaluateDailyDrivingLimit(summaries, events);
    const compliant = findings.filter(f => f.result === 'COMPLIANT');
    
    expect(compliant.length).toBe(1);
  });

  test('día 9h30 con extensión disponible → COMPLIANT con WARNING', () => {
    // Semana con solo este día excedido
    const summaries = [
      makeSummary('2025-11-03', 570), // Lunes 9h30
      makeSummary('2025-11-04', 480), // Martes 8h
    ];
    const events = [
      makeEvent('DRIVING', '2025-11-03', 0, 570),
      makeEvent('DRIVING', '2025-11-04', 0, 480),
    ];

    const findings = evaluateDailyDrivingLimit(summaries, events);
    // El día de 9h30 usa 1 extensión → COMPLIANT con WARNING
    const extDay = findings.find(
      f => f.minutesObserved === 570
    );
    expect(extDay).toBeDefined();
    expect(extDay!.result).toBe('COMPLIANT');
    expect(extDay!.severity).toBe('WARNING');
  });

  test('3er día >9h en la semana → NON_COMPLIANT (extensiones agotadas)', () => {
    // 3 días con >540 en la misma semana ISO
    const summaries = [
      makeSummary('2025-11-03', 570), // Lunes 9h30 → ext 1
      makeSummary('2025-11-04', 580), // Martes 9h40 → ext 2
      makeSummary('2025-11-05', 560), // Miércoles 9h20 → ext 3 → NO HAY
    ];
    const events = [
      makeEvent('DRIVING', '2025-11-03', 0, 570),
      makeEvent('DRIVING', '2025-11-04', 0, 580),
      makeEvent('DRIVING', '2025-11-05', 0, 560),
    ];

    const findings = evaluateDailyDrivingLimit(summaries, events);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    // El tercer día debería ser NON_COMPLIANT
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(560);
  });

  test('día >10h → siempre NON_COMPLIANT', () => {
    const summaries = [makeSummary('2025-11-03', 615)]; // 10h15
    const events = [makeEvent('DRIVING', '2025-11-03', 0, 615)];

    const findings = evaluateDailyDrivingLimit(summaries, events);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(615);
    expect(violations[0].minutesExceeded).toBe(15); // 615 - 600
  });
});

// ====================================
// 3. WEEKLY_DRIVING_LIMIT
// ====================================

describe('WEEKLY_DRIVING_LIMIT', () => {
  test('semana con 50h → COMPLIANT', () => {
    const summaries = [
      makeSummary('2025-11-03', 500), // Lunes
      makeSummary('2025-11-04', 500), // Martes
      makeSummary('2025-11-05', 500), // Miércoles
      makeSummary('2025-11-06', 500), // Jueves
      makeSummary('2025-11-07', 500), // Viernes
      makeSummary('2025-11-08', 500), // Sábado
    ];

    const findings = evaluateWeeklyDrivingLimit(summaries);
    const compliant = findings.filter(f => f.result === 'COMPLIANT');
    
    expect(compliant.length).toBe(1);
    expect(compliant[0].minutesObserved).toBe(3000); // 50h
  });

  test('semana con 57h → NON_COMPLIANT', () => {
    const summaries = [
      makeSummary('2025-11-03', 570),
      makeSummary('2025-11-04', 570),
      makeSummary('2025-11-05', 570),
      makeSummary('2025-11-06', 570),
      makeSummary('2025-11-07', 570),
      makeSummary('2025-11-08', 570),
    ];

    const findings = evaluateWeeklyDrivingLimit(summaries);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(3420); // 57h
    expect(violations[0].minutesExceeded).toBe(60);   // 3420 - 3360
  });
});

// ====================================
// 4. FORTNIGHT_DRIVING_LIMIT
// ====================================

describe('FORTNIGHT_DRIVING_LIMIT', () => {
  test('dos semanas con 80h → COMPLIANT', () => {
    // Semana 1: lun-dom
    const week1 = [
      makeSummary('2025-11-03', 480),
      makeSummary('2025-11-04', 480),
      makeSummary('2025-11-05', 480),
      makeSummary('2025-11-06', 480),
      makeSummary('2025-11-07', 480),
    ];
    // Semana 2: lun-dom siguiente
    const week2 = [
      makeSummary('2025-11-10', 480),
      makeSummary('2025-11-11', 480),
      makeSummary('2025-11-12', 480),
      makeSummary('2025-11-13', 480),
      makeSummary('2025-11-14', 480),
    ];

    const findings = evaluateFortnightDrivingLimit([...week1, ...week2]);
    const compliant = findings.filter(f => f.result === 'COMPLIANT');
    
    expect(compliant.length).toBe(1);
    expect(compliant[0].minutesObserved).toBe(4800); // 80h
  });

  test('dos semanas con 92h → NON_COMPLIANT', () => {
    const week1 = [
      makeSummary('2025-11-03', 540),
      makeSummary('2025-11-04', 540),
      makeSummary('2025-11-05', 540),
      makeSummary('2025-11-06', 540),
      makeSummary('2025-11-07', 540),
      makeSummary('2025-11-08', 60),
    ];
    const week2 = [
      makeSummary('2025-11-10', 540),
      makeSummary('2025-11-11', 540),
      makeSummary('2025-11-12', 540),
      makeSummary('2025-11-13', 540),
      makeSummary('2025-11-14', 540),
      makeSummary('2025-11-15', 60),
    ];

    const findings = evaluateFortnightDrivingLimit([...week1, ...week2]);
    const violations = findings.filter(f => f.result === 'NON_COMPLIANT');
    
    expect(violations.length).toBe(1);
    expect(violations[0].minutesObserved).toBe(5520); // 92h
    expect(violations[0].minutesExceeded).toBe(120);  // 5520 - 5400
  });
});

// ====================================
// 5. Evaluabilidad
// ====================================

describe('Evaluabilidad', () => {
  test('día BLOCKED_NO_SOURCE → NOT_EVALUABLE', () => {
    const summaries = [
      { date: '2025-11-03', dayConsolidationStatus: 'BLOCKED_NO_SOURCE', averageConfidence: 'medium', totalDrivingMinutes: 0, calendarCoverageRatio: 0 },
    ];
    
    const result = assessEvaluability(
      summaries,
      new Date('2025-11-03'),
      new Date('2025-11-03'),
    );
    
    expect(result.evaluability).toBe('NOT_EVALUABLE');
    expect(result.blockedDays).toContain('2025-11-03');
  });

  test('semana con 2 días sin datos → PARTIALLY_EVALUABLE', () => {
    const summaries = [
      { date: '2025-11-03', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.9 },
      { date: '2025-11-04', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.9 },
      { date: '2025-11-05', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.9 },
      { date: '2025-11-06', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.9 },
      { date: '2025-11-07', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.9 },
      // 2025-11-08 y 2025-11-09 no tienen datos
    ];
    
    const result = assessEvaluability(
      summaries,
      new Date('2025-11-03'),
      new Date('2025-11-09'),
    );
    
    expect(result.evaluability).toBe('PARTIALLY_EVALUABLE');
    expect(result.gapDays.length).toBe(2);
  });

  test('todos los días VALID → EVALUABLE con HIGH confidence', () => {
    const summaries = [
      { date: '2025-11-03', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.95 },
      { date: '2025-11-04', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.95 },
      { date: '2025-11-05', dayConsolidationStatus: 'VALID', averageConfidence: 'medium', totalDrivingMinutes: 480, calendarCoverageRatio: 0.95 },
    ];
    
    const result = assessEvaluability(
      summaries,
      new Date('2025-11-03'),
      new Date('2025-11-05'),
    );
    
    expect(result.evaluability).toBe('EVALUABLE');
    expect(result.confidence).toBe('HIGH');
  });
});
