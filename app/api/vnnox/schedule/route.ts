/**
 * VNNOX Schedule API
 * POST — Schedule screen status and brightness
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VnnoxClient } from '@/lib/vnnox/vnnox-client';
import { registrarAuditoria } from '@/lib/auditoria';
import { decrypt } from '@/lib/vnnox/crypto-utils';

// Presets
const SCHEDULE_PRESETS: Record<string, { label: string; entries: any[] }> = {
  dia: {
    label: 'Día (06:00-22:00)',
    entries: [
      { startTime: '06:00', endTime: '22:00', status: 'ON', brightness: 100, daysOfWeek: [1, 2, 3, 4, 5, 6, 0] },
      { startTime: '22:00', endTime: '06:00', status: 'OFF', brightness: 0, daysOfWeek: [1, 2, 3, 4, 5, 6, 0] },
    ],
  },
  noche: {
    label: 'Noche (18:00-08:00)',
    entries: [
      { startTime: '18:00', endTime: '08:00', status: 'ON', brightness: 70, daysOfWeek: [1, 2, 3, 4, 5, 6, 0] },
      { startTime: '08:00', endTime: '18:00', status: 'OFF', brightness: 0, daysOfWeek: [1, 2, 3, 4, 5, 6, 0] },
    ],
  },
  fin_de_semana: {
    label: 'Fin de semana (07:00-23:00)',
    entries: [
      { startTime: '07:00', endTime: '23:00', status: 'ON', brightness: 100, daysOfWeek: [6, 0] },
      { startTime: '23:00', endTime: '07:00', status: 'OFF', brightness: 0, daysOfWeek: [6, 0] },
    ],
  },
  festivo: {
    label: 'Festivo (08:00-20:00)',
    entries: [
      { startTime: '08:00', endTime: '20:00', status: 'ON', brightness: 90, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      { startTime: '20:00', endTime: '08:00', status: 'OFF', brightness: 0, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
  '24h': {
    label: '24 horas',
    entries: [
      { startTime: '00:00', endTime: '06:00', status: 'ON', brightness: 50, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      { startTime: '06:00', endTime: '20:00', status: 'ON', brightness: 100, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      { startTime: '20:00', endTime: '00:00', status: 'ON', brightness: 70, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    return NextResponse.json({ presets: SCHEDULE_PRESETS });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { type, playerId, entries, presetId } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'playerId es obligatorio' }, { status: 400 });
    }

    if (!type || !['screen-status', 'brightness'].includes(type)) {
      return NextResponse.json({ error: 'type debe ser "screen-status" o "brightness"' }, { status: 400 });
    }

    // Use preset if provided
    const scheduleEntries = presetId && SCHEDULE_PRESETS[presetId]
      ? SCHEDULE_PRESETS[presetId].entries
      : entries;

    if (!scheduleEntries || !Array.isArray(scheduleEntries) || scheduleEntries.length === 0) {
      return NextResponse.json({ error: 'Se requieren entradas de programación' }, { status: 400 });
    }

    // Get VNNOX client
    const config = await prisma.displayProviderConfig.findFirst({
      where: { provider: 'VNNOX', isActive: true },
    });

    if (!config) {
      return NextResponse.json({ error: 'No hay configuración VNNOX activa' }, { status: 400 });
    }

    const appSecret = decrypt(config.appSecretEncrypted);
    const client = new VnnoxClient({
      baseUrl: config.baseUrl,
      appKey: config.appKey,
      appSecret,
    });

    const payload = { playerId, entries: scheduleEntries };
    let result;

    if (type === 'screen-status') {
      result = await client.scheduleScreenStatus(payload);
    } else {
      result = await client.scheduleBrightness(payload);
    }

    // Find or create a system log (not linked to specific draft)
    // We'll use the most recent draft for this screen for logging
    const screen = await prisma.displayScreen.findUnique({ where: { playerId } });
    if (screen) {
      const latestDraft = await prisma.displayDraft.findFirst({
        where: { screenId: screen.id },
        orderBy: { createdAt: 'desc' },
      });

      if (latestDraft) {
        await prisma.displayPublicationLog.create({
          data: {
            draftId: latestDraft.id,
            action: type === 'screen-status' ? 'SCHEDULE_SCREEN' : 'SCHEDULE_BRIGHTNESS',
            requestPayloadJson: payload as any,
            responsePayloadJson: result.rawResponse as any,
            success: result.success,
            errorMessage: result.success ? null : result.message,
            performedByUserId: (session as any).id,
          },
        });
      }
    }

    await registrarAuditoria(
      (session as any).id,
      type === 'screen-status' ? 'VNNOX_SCHEDULE_SCREEN' : 'VNNOX_SCHEDULE_BRIGHTNESS',
      'DisplayScreen',
      screen?.id || 0,
      { playerId, type, presetId, entriesCount: scheduleEntries.length, success: result.success }
    );

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `${type === 'screen-status' ? 'Programación de pantalla' : 'Programación de brillo'} aplicada correctamente`
        : result.message,
      result,
    });
  } catch (error) {
    console.error('[VNNOX Schedule POST]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
