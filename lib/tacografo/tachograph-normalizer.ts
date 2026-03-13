/**
 * TachographNormalizer — Normalización interna de actividades
 * 
 * Se ejecuta DESPUÉS del parsing y ANTES de guardar en BD.
 * Responsabilidades:
 *   - Fusionar actividades solapadas del mismo tipo
 *   - Rellenar huecos con REST/UNKNOWN
 *   - Dividir actividades que cruzan medianoche
 *   - Validar que no se excedan 24h por día
 *   - Calcular resúmenes diarios
 *   - Deduplicar con importaciones previas
 */

import type { TachographParseResult } from './tachograph-parser';

// Re-export the activity type for convenience
export type ActivityType = 'DRIVING' | 'OTHER_WORK' | 'AVAILABILITY' | 'REST' | 'BREAK' | 'UNKNOWN';

export interface NormalizedActivity {
  activityType: ActivityType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  countryStart?: string;
  countryEnd?: string;
  rawPayload?: any;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  totalDrivingMinutes: number;
  totalOtherWorkMinutes: number;
  totalAvailabilityMinutes: number;
  totalRestMinutes: number;
  totalBreakMinutes: number;
  totalUnknownMinutes: number;
  coveragePercent: number; // 0-100, how much of the day is covered
  consistencyStatus: 'OK' | 'INCOMPLETE' | 'OVERFLOW' | 'CONFLICT';
  importedFromCount: number;
}

export interface RegulationIncident {
  type: 'DRIVING_TIME_EXCEEDED' | 'DAILY_DRIVING_EXCEEDED' | 'INSUFFICIENT_REST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  date: string;
  durationMinutes?: number;
}

export interface NormalizationResult {
  activities: NormalizedActivity[];
  dailySummaries: DailySummary[];
  incidents: RegulationIncident[];
  warnings: string[];
}

// ====================================
// Main normalization pipeline
// ====================================

export function normalizeActivities(
  rawActivities: TachographParseResult['activities'],
  existingActivities?: { startTime: Date; endTime: Date; activityType: string }[]
): NormalizationResult {
  const warnings: string[] = [];
  
  if (rawActivities.length === 0) {
    return { activities: [], dailySummaries: [], incidents: [], warnings: ['No hay actividades para normalizar.'] };
  }

  // 1. Convert to NormalizedActivity and sort by start time
  let activities: NormalizedActivity[] = rawActivities
    .map(a => ({
      activityType: a.activityType as ActivityType,
      startTime: new Date(a.startTime),
      endTime: new Date(a.endTime),
      durationMinutes: a.durationMinutes,
      confidenceLevel: a.confidenceLevel,
      countryStart: a.countryStart,
      countryEnd: a.countryEnd,
      rawPayload: a.rawPayload,
    }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // 2. Merge overlapping activities of the same type
  activities = mergeOverlappingActivities(activities);

  // 3. Deduplicate with existing activities in DB
  if (existingActivities && existingActivities.length > 0) {
    const { deduplicated, removedCount } = deduplicateAcrossImports(activities, existingActivities);
    activities = deduplicated;
    if (removedCount > 0) {
      warnings.push(`Se eliminaron ${removedCount} actividades duplicadas con importaciones anteriores.`);
    }
  }

  // 4. Split activities crossing midnight
  activities = splitByDay(activities);

  // 5. Fill gaps between consecutive activities (> 5 min gap → REST)
  activities = fillGaps(activities);

  // 6. Validate time limits (no day > 24h)
  const { validated, overflowDays } = validateTimeLimits(activities);
  activities = validated;
  for (const day of overflowDays) {
    warnings.push(`Día ${day}: las actividades suman más de 24h. Confianza reducida a 'low'.`);
  }

  // 7. Recalculate durations
  activities = activities.map(a => ({
    ...a,
    durationMinutes: Math.round((a.endTime.getTime() - a.startTime.getTime()) / 60000),
  }));

  // 8. Calculate daily summaries
  const dailySummaries = calculateDailySummaries(activities);

  // 9. Check regulation limits
  const incidents = checkRegulationLimits(activities, dailySummaries);

  return { activities, dailySummaries, incidents, warnings };
}

// ====================================
// Merge overlapping activities
// ====================================

function mergeOverlappingActivities(activities: NormalizedActivity[]): NormalizedActivity[] {
  if (activities.length <= 1) return activities;

  const merged: NormalizedActivity[] = [{ ...activities[0] }];

  for (let i = 1; i < activities.length; i++) {
    const current = activities[i];
    const prev = merged[merged.length - 1];

    // Same type and overlapping or adjacent (< 2 min gap)
    if (
      prev.activityType === current.activityType &&
      current.startTime.getTime() <= prev.endTime.getTime() + 120000
    ) {
      // Extend previous activity
      if (current.endTime.getTime() > prev.endTime.getTime()) {
        prev.endTime = new Date(current.endTime);
      }
      prev.durationMinutes = Math.round((prev.endTime.getTime() - prev.startTime.getTime()) / 60000);
      // Keep best confidence
      if (current.confidenceLevel === 'high') prev.confidenceLevel = 'high';
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

// ====================================
// Deduplicate across imports
// ====================================

function deduplicateAcrossImports(
  newActivities: NormalizedActivity[],
  existingActivities: { startTime: Date; endTime: Date; activityType: string }[]
): { deduplicated: NormalizedActivity[]; removedCount: number } {
  const deduplicated: NormalizedActivity[] = [];
  let removedCount = 0;

  for (const act of newActivities) {
    const isDuplicate = existingActivities.some(existing => {
      // Consider duplicate if same type and time overlap > 80%
      if (existing.activityType !== act.activityType) return false;
      
      const overlapStart = Math.max(act.startTime.getTime(), new Date(existing.startTime).getTime());
      const overlapEnd = Math.min(act.endTime.getTime(), new Date(existing.endTime).getTime());
      const overlapMs = Math.max(0, overlapEnd - overlapStart);
      
      const actDuration = act.endTime.getTime() - act.startTime.getTime();
      if (actDuration <= 0) return true; // Zero duration → discard
      
      return overlapMs / actDuration > 0.8;
    });

    if (isDuplicate) {
      removedCount++;
    } else {
      deduplicated.push(act);
    }
  }

  return { deduplicated, removedCount };
}

// ====================================
// Fill gaps between activities
// ====================================

function fillGaps(activities: NormalizedActivity[]): NormalizedActivity[] {
  if (activities.length <= 1) return activities;

  const result: NormalizedActivity[] = [activities[0]];

  for (let i = 1; i < activities.length; i++) {
    const prev = result[result.length - 1];
    const current = activities[i];
    
    const gapMs = current.startTime.getTime() - prev.endTime.getTime();
    const gapMinutes = gapMs / 60000;

    // If gap > 5 minutes, insert a REST block
    if (gapMinutes > 5) {
      result.push({
        activityType: 'REST',
        startTime: new Date(prev.endTime),
        endTime: new Date(current.startTime),
        durationMinutes: Math.round(gapMinutes),
        confidenceLevel: 'low', // Inferred, not from data
      });
    }

    result.push(current);
  }

  return result;
}

// ====================================
// Split activities crossing midnight
// ====================================

function splitByDay(activities: NormalizedActivity[]): NormalizedActivity[] {
  const result: NormalizedActivity[] = [];

  for (const act of activities) {
    const startDate = new Date(act.startTime);
    const endDate = new Date(act.endTime);
    
    // Check if the activity spans multiple days
    const startDay = startDate.toISOString().split('T')[0];
    const endDay = endDate.toISOString().split('T')[0];

    if (startDay === endDay) {
      result.push(act);
    } else {
      // Split at midnight boundaries
      let currentStart = new Date(act.startTime);
      
      while (true) {
        // Calculate next midnight
        const nextMidnight = new Date(currentStart);
        nextMidnight.setUTCHours(0, 0, 0, 0);
        nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);

        if (nextMidnight.getTime() >= act.endTime.getTime()) {
          // Last segment
          result.push({
            ...act,
            startTime: currentStart,
            endTime: new Date(act.endTime),
            durationMinutes: Math.round((act.endTime.getTime() - currentStart.getTime()) / 60000),
          });
          break;
        } else {
          // Segment ending at midnight
          result.push({
            ...act,
            startTime: currentStart,
            endTime: nextMidnight,
            durationMinutes: Math.round((nextMidnight.getTime() - currentStart.getTime()) / 60000),
          });
          currentStart = nextMidnight;
        }
      }
    }
  }

  return result;
}

// ====================================
// Validate time limits
// ====================================

function validateTimeLimits(activities: NormalizedActivity[]): {
  validated: NormalizedActivity[];
  overflowDays: string[];
} {
  // Group by day
  const byDay = new Map<string, NormalizedActivity[]>();
  for (const act of activities) {
    const day = act.startTime.toISOString().split('T')[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(act);
  }

  const overflowDays: string[] = [];
  const validated: NormalizedActivity[] = [];

  for (const [day, dayActivities] of byDay) {
    const totalMinutes = dayActivities.reduce((sum, a) => {
      return sum + Math.round((a.endTime.getTime() - a.startTime.getTime()) / 60000);
    }, 0);

    if (totalMinutes > 1440 * 1.1) { // > 110% of a day
      overflowDays.push(day);
      // Mark all activities of this day as low confidence
      for (const act of dayActivities) {
        validated.push({ ...act, confidenceLevel: 'low' });
      }
    } else {
      validated.push(...dayActivities);
    }
  }

  return { validated, overflowDays };
}

// ====================================
// Calculate daily summaries
// ====================================

function calculateDailySummaries(activities: NormalizedActivity[]): DailySummary[] {
  const byDay = new Map<string, NormalizedActivity[]>();
  for (const act of activities) {
    const day = act.startTime.toISOString().split('T')[0];
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(act);
  }

  const summaries: DailySummary[] = [];

  for (const [date, dayActivities] of byDay) {
    const totalDriving = sumMinutesByType(dayActivities, 'DRIVING');
    const totalOtherWork = sumMinutesByType(dayActivities, 'OTHER_WORK');
    const totalAvailability = sumMinutesByType(dayActivities, 'AVAILABILITY');
    const totalRest = sumMinutesByType(dayActivities, 'REST');
    const totalBreak = sumMinutesByType(dayActivities, 'BREAK');
    const totalUnknown = sumMinutesByType(dayActivities, 'UNKNOWN');

    const totalCovered = totalDriving + totalOtherWork + totalAvailability + totalRest + totalBreak + totalUnknown;
    const coveragePercent = Math.min(100, Math.round((totalCovered / 1440) * 100));

    let consistencyStatus: DailySummary['consistencyStatus'];
    if (totalCovered > 1440 * 1.1) {
      consistencyStatus = 'OVERFLOW';
    } else if (coveragePercent < 80) {
      consistencyStatus = 'INCOMPLETE';
    } else {
      consistencyStatus = 'OK';
    }

    summaries.push({
      date,
      totalDrivingMinutes: totalDriving,
      totalOtherWorkMinutes: totalOtherWork,
      totalAvailabilityMinutes: totalAvailability,
      totalRestMinutes: totalRest,
      totalBreakMinutes: totalBreak,
      totalUnknownMinutes: totalUnknown,
      coveragePercent,
      consistencyStatus,
      importedFromCount: 1,
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

function sumMinutesByType(activities: NormalizedActivity[], type: ActivityType): number {
  return activities
    .filter(a => a.activityType === type)
    .reduce((sum, a) => sum + a.durationMinutes, 0);
}

// ====================================
// Regulation checks
// ====================================

function checkRegulationLimits(
  activities: NormalizedActivity[],
  dailySummaries: DailySummary[]
): RegulationIncident[] {
  const incidents: RegulationIncident[] = [];

  // 1. Check continuous driving > 4h30min without a break of >= 45 min
  const sortedActivities = [...activities].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  let continuousDrivingMinutes = 0;
  let drivingBlockStart: Date | null = null;

  for (const act of sortedActivities) {
    if (act.activityType === 'DRIVING') {
      if (drivingBlockStart === null) {
        drivingBlockStart = act.startTime;
      }
      continuousDrivingMinutes += act.durationMinutes;

      if (continuousDrivingMinutes > 270) { // 4h30min = 270 min
        incidents.push({
          type: 'DRIVING_TIME_EXCEEDED',
          severity: 'HIGH',
          title: `Conducción continua > 4h30min`,
          description: `El conductor acumuló ${Math.round(continuousDrivingMinutes)} min de conducción continua sin pausa reglamentaria (≥45min). Inicio: ${drivingBlockStart!.toISOString()}.`,
          date: act.startTime.toISOString().split('T')[0],
          durationMinutes: continuousDrivingMinutes,
        });
        // Reset to avoid duplicating incident for same block
        continuousDrivingMinutes = 0;
        drivingBlockStart = null;
      }
    } else if (act.activityType === 'REST' || act.activityType === 'BREAK') {
      // Only reset if the rest/break is >= 45 min (regulation requirement)
      if (act.durationMinutes >= 45) {
        continuousDrivingMinutes = 0;
        drivingBlockStart = null;
      }
      // Partial breaks: 15+30 split is allowed but complex to detect — skip for now
    } else {
      // OTHER_WORK and AVAILABILITY don't reset the driving counter
      // but they also don't count as driving
    }
  }

  // 2. Check daily driving > 9h (can be 10h max 2x per week, but we flag >9h always)
  for (const summary of dailySummaries) {
    if (summary.totalDrivingMinutes > 540) { // 9h = 540 min
      const severity = summary.totalDrivingMinutes > 600 ? 'HIGH' : 'MEDIUM'; // >10h = HIGH
      incidents.push({
        type: 'DAILY_DRIVING_EXCEEDED',
        severity,
        title: `Jornada conducción > ${summary.totalDrivingMinutes > 600 ? '10h' : '9h'} el ${summary.date}`,
        description: `El conductor acumuló ${Math.round(summary.totalDrivingMinutes / 60 * 10) / 10}h de conducción en el día ${summary.date}. Máximo general: 9h (10h excepcional 2x/semana).`,
        date: summary.date,
        durationMinutes: summary.totalDrivingMinutes,
      });
    }
  }

  // 3. Check insufficient daily rest (< 11h, or < 9h reduced)
  for (const summary of dailySummaries) {
    const totalRest = summary.totalRestMinutes + summary.totalBreakMinutes;
    if (totalRest < 540 && summary.coveragePercent >= 80) { // < 9h rest and we have enough data
      incidents.push({
        type: 'INSUFFICIENT_REST',
        severity: totalRest < 480 ? 'HIGH' : 'MEDIUM', // < 8h = HIGH
        title: `Descanso insuficiente el ${summary.date}`,
        description: `El conductor solo descansó ${Math.round(totalRest / 60 * 10) / 10}h el día ${summary.date}. Mínimo: 11h (reducido: 9h).`,
        date: summary.date,
        durationMinutes: totalRest,
      });
    }
  }

  return incidents;
}
