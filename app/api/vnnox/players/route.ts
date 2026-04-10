/**
 * VNNOX Players API
 * GET  — List players from VNNOX
 * POST — Sync/save player to DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VnnoxClient } from '@/lib/vnnox/vnnox-client';
import { registrarAuditoria } from '@/lib/auditoria';
import { decrypt } from '@/lib/vnnox/crypto-utils';

async function getVnnoxClient() {
  const config = await prisma.displayProviderConfig.findFirst({
    where: { provider: 'VNNOX', isActive: true },
  });

  if (!config) {
    throw new Error('No hay configuración VNNOX activa');
  }

  const appSecret = decrypt(config.appSecretEncrypted);
  if (!appSecret) {
    throw new Error('Error al descifrar AppSecret');
  }

  return {
    client: new VnnoxClient({
      baseUrl: config.baseUrl,
      appKey: config.appKey,
      appSecret,
    }),
    configId: config.id,
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { client } = await getVnnoxClient();
    const result = await client.getPlayers();

    if (!result.success) {
      return NextResponse.json({
        error: result.message || 'Error al obtener players',
        players: [],
      }, { status: 502 });
    }

    // Also return locally saved screens
    const savedScreens = await prisma.displayScreen.findMany({
      include: { providerConfig: true },
    });

    return NextResponse.json({
      players: result.data || [],
      savedScreens,
    });
  } catch (error) {
    console.error('[VNNOX Players GET]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
      players: [],
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { playerId, setAsDefault } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'playerId es obligatorio' }, { status: 400 });
    }

    const { client, configId } = await getVnnoxClient();

    // Get detailed player info via v2 endpoints
    const playerInfo = await client.getPlayerFullInfo(playerId);
    if (!playerInfo.success || !playerInfo.data) {
      return NextResponse.json({
        error: playerInfo.message || 'No se pudo obtener información del player',
      }, { status: 502 });
    }

    const detail = playerInfo.data;

    // Upsert screen in DB
    const screen = await prisma.displayScreen.upsert({
      where: { playerId },
      update: {
        playerName: detail.playerName,
        resolutionWidth: detail.resolutionWidth || null,
        resolutionHeight: detail.resolutionHeight || null,
        orientation: detail.orientation || 'HORIZONTAL',
        isOnline: detail.isOnline,
        metadataJson: (detail.metadata || {}) as any,
        lastSyncAt: new Date(),
      },
      create: {
        providerConfigId: configId,
        playerId,
        playerName: detail.playerName,
        resolutionWidth: detail.resolutionWidth || null,
        resolutionHeight: detail.resolutionHeight || null,
        orientation: detail.orientation || 'HORIZONTAL',
        isOnline: detail.isOnline,
        metadataJson: (detail.metadata || {}) as any,
        lastSyncAt: new Date(),
      },
    });

    // Set as default player if requested
    if (setAsDefault) {
      await prisma.displayProviderConfig.update({
        where: { id: configId },
        data: { defaultPlayerId: playerId },
      });
    }

    await registrarAuditoria(
      (session as any).id,
      'VNNOX_PLAYER_SYNC',
      'DisplayScreen',
      screen.id,
      {
        playerId,
        playerName: detail.playerName,
        resolution: `${detail.resolutionWidth}x${detail.resolutionHeight}`,
        isOnline: detail.isOnline,
        setAsDefault,
      }
    );

    return NextResponse.json({ screen, playerDetail: detail });
  } catch (error) {
    console.error('[VNNOX Players POST]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
