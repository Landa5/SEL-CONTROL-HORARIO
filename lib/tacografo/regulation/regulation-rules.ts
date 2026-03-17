/**
 * regulation-rules.ts — Definición de reglas y umbrales CE 561/2006
 * 
 * Todas las constantes provienen del Reglamento (CE) 561/2006 del Parlamento
 * Europeo y del Consejo, actualizado por el Reglamento (UE) 2020/1054
 * (Mobility Package I).
 */

// ====================================
// Tipos
// ====================================

export type RuleCode =
  | 'BREAK_AFTER_4H30'
  | 'DAILY_DRIVING_LIMIT'
  | 'WEEKLY_DRIVING_LIMIT'
  | 'FORTNIGHT_DRIVING_LIMIT'
  | 'DAILY_REST_MINIMUM'
  | 'WEEKLY_REST_MINIMUM'
  | 'REDUCED_WEEKLY_REST_COMPENSATION';

export type RuleCategory = 'DRIVING_TIME' | 'BREAK_TIME' | 'REST_TIME';

export type FindingResult = 'COMPLIANT' | 'NON_COMPLIANT' | 'POTENTIAL_NON_COMPLIANCE' | 'NOT_EVALUABLE';
export type FindingSeverity = 'INFO' | 'WARNING' | 'VIOLATION';
export type FindingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Evaluability = 'EVALUABLE' | 'PARTIALLY_EVALUABLE' | 'NOT_EVALUABLE';

// ====================================
// Actividades que cuentan para cada concepto normativo
// ====================================

/** Actividades que interrumpen la conducción continua (Art. 7) */
export const BREAK_INTERRUPTING_ACTIVITIES = ['REST', 'BREAK'] as const;

/** Actividades que NO interrumpen la conducción continua */
export const NON_BREAK_ACTIVITIES = ['OTHER_WORK', 'AVAILABILITY'] as const;

/** Actividades que cuentan como descanso diario (Art. 8) */
export const DAILY_REST_ACTIVITIES = ['REST'] as const;

// ====================================
// Umbrales por regla
// ====================================

export interface RuleThresholds {
  ruleCode: RuleCode;
  category: RuleCategory;
  article: string;
  description: string;
  thresholds: Record<string, number>;
}

export const REGULATION_RULES: Record<string, RuleThresholds> = {
  BREAK_AFTER_4H30: {
    ruleCode: 'BREAK_AFTER_4H30',
    category: 'BREAK_TIME',
    article: 'Art. 7 CE 561/2006',
    description: 'Tras un período de conducción de 4h30min, el conductor deberá hacer una pausa ininterrumpida de al menos 45 minutos.',
    thresholds: {
      maxContinuousDrivingMin: 270,     // 4h 30min
      requiredBreakMin: 45,             // Pausa mínima
      splitBreakFirstMin: 15,           // Primera parte del split
      splitBreakSecondMin: 30,          // Segunda parte del split
    },
  },

  DAILY_DRIVING_LIMIT: {
    ruleCode: 'DAILY_DRIVING_LIMIT',
    category: 'DRIVING_TIME',
    article: 'Art. 6.1 CE 561/2006',
    description: 'El tiempo de conducción diario no excederá de 9 horas. Podrá ampliarse hasta 10 horas un máximo de dos veces por semana.',
    thresholds: {
      normalLimitMin: 540,              // 9h
      extendedLimitMin: 600,            // 10h
      maxExtensionsPerWeek: 2,
    },
  },

  WEEKLY_DRIVING_LIMIT: {
    ruleCode: 'WEEKLY_DRIVING_LIMIT',
    category: 'DRIVING_TIME',
    article: 'Art. 6.2 CE 561/2006',
    description: 'El tiempo de conducción semanal no excederá de 56 horas.',
    thresholds: {
      maxWeeklyMin: 3360,               // 56h
    },
  },

  FORTNIGHT_DRIVING_LIMIT: {
    ruleCode: 'FORTNIGHT_DRIVING_LIMIT',
    category: 'DRIVING_TIME',
    article: 'Art. 6.3 CE 561/2006',
    description: 'El tiempo de conducción acumulado durante dos semanas consecutivas no excederá de 90 horas.',
    thresholds: {
      maxFortnightMin: 5400,            // 90h
    },
  },

  DAILY_REST_MINIMUM: {
    ruleCode: 'DAILY_REST_MINIMUM',
    category: 'REST_TIME',
    article: 'Art. 8.2 CE 561/2006',
    description: 'En cada período de 24 horas desde el final del descanso diario o semanal anterior, el conductor deberá tomar un nuevo descanso diario.',
    thresholds: {
      normalRestMin: 660,               // 11h
      reducedRestMin: 540,              // 9h
      splitRestFirstMin: 180,           // 3h (primera parte)
      splitRestSecondMin: 540,          // 9h (segunda parte, total 12h)
      maxReducedBetweenWeeklyRests: 3,  // Máx 3 reducidos entre descansos semanales
      dailyPeriodHours: 24,             // Ventana de evaluación
    },
  },
} as const;

// ====================================
// Zona horaria de referencia
// ====================================

/** 
 * Todos los cálculos normativos usan Europe/Madrid.
 * La semana ISO va de lunes 00:00 a domingo 23:59 en esta zona.
 */
export const REGULATION_TIMEZONE = 'Europe/Madrid';

// ====================================
// Semana ISO helper
// ====================================

/**
 * Calcula el número de semana ISO y el año ISO de una fecha.
 * Semana ISO: lunes es el primer día; la semana 1 contiene el primer jueves del año.
 */
export function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Obtiene el lunes 00:00 (Europe/Madrid) de la semana ISO que contiene la fecha dada.
 */
export function getISOWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // 1=Monday ... 7=Sunday
  d.setUTCDate(d.getUTCDate() - (dayOfWeek - 1));
  return d;
}

/**
 * Obtiene el domingo 23:59:59 (Europe/Madrid) de la semana ISO que contiene la fecha dada.
 */
export function getISOWeekEnd(date: Date): Date {
  const start = getISOWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Genera un key único de semana ISO: "2025-W43"
 */
export function weekKey(date: Date): string {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
