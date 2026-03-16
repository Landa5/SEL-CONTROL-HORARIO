/**
 * POST /api/tacografo/trace
 * 
 * Endpoint de diagnóstico para analizar archivos TGD con trace completo.
 * Solo accesible por ADMIN.
 * 
 * Body: { base64, fileName, targetDate?, windowDays?, mode?, maxResults? }
 */

import { NextResponse } from 'next/server';
import { parseBinaryTachographWithTrace } from '@/lib/tacografo/tachograph-binary-parser';
import { traceToSummaryMode } from '@/lib/tacografo/tachograph-trace';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export const maxDuration = 60;

export async function POST(request: Request) {
  // Auth check: require admin
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos (solo ADMIN)' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { base64, fileName, targetDate, windowDays, mode, maxResults } = body;

    if (!base64 || !fileName) {
      return NextResponse.json(
        { error: 'Se requiere base64 y fileName' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(base64, 'base64');

    const { result, trace } = parseBinaryTachographWithTrace(buffer, fileName, {
      targetDate: targetDate || undefined,
      windowDays: windowDays ?? 1,
      mode: mode || 'detailed',
      maxResults: maxResults ?? 500,
    });

    // Build response based on mode
    const responseTrace = mode === 'summary'
      ? traceToSummaryMode(trace)
      : trace;

    return NextResponse.json({
      success: true,
      parseResult: {
        fileType: result.fileType,
        parserVersion: result.parserVersion,
        rawEventsCount: result.rawEvents.length,
        metadata: {
          ...result.metadata,
          // Exclude large fields from response
          vehicleUsedRecords: result.metadata.vehicleUsedRecords?.map(vr => ({
            vrn: vr.vrn,
            startDate: vr.startDate?.toISOString(),
            endDate: vr.endDate?.toISOString(),
          })),
        },
        warnings: result.warnings,
        errors: result.errors,
      },
      trace: responseTrace,
      // Quick diagnostic for target date
      ...(targetDate ? {
        diagnostic: {
          targetDate,
          hasCandidates: trace.candidateBlocks.some(b => b.dayDate === targetDate),
          hasAcceptedBlocks: trace.candidateBlocks.some(b => b.dayDate === targetDate && b.status === 'ACCEPTED'),
          hasRejectedBlocks: trace.candidateBlocks.some(b => b.dayDate === targetDate && (b.status === 'REJECTED' || b.status === 'BLOCKED_CONFIDENCE' || b.status === 'BLOCKED_CONFLICT')),
          conclusion: (() => {
            const targetBlocks = trace.candidateBlocks.filter(b => b.dayDate === targetDate);
            if (targetBlocks.length === 0) return 'NO_CANDIDATES';
            if (targetBlocks.some(b => b.status === 'ACCEPTED')) return 'CANDIDATES_ACCEPTED';
            if (targetBlocks.some(b => b.status === 'BLOCKED_CONFIDENCE' || b.status === 'BLOCKED_CONFLICT')) return 'CANDIDATES_BLOCKED';
            return 'CANDIDATES_REJECTED';
          })(),
          candidateDetails: trace.candidateBlocks
            .filter(b => b.dayDate === targetDate)
            .map(b => ({
              status: b.status,
              reason: b.reason,
              recordsCount: b.recordsCount,
              totalMinutes: b.totalMinutes,
            })),
        },
      } : {}),
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Error en el trace', details: err.message },
      { status: 500 }
    );
  }
}
