/**
 * VNNOX Configuration API
 * 
 * GET  — Get current config
 * POST — Create/update config
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import { encrypt } from '@/lib/vnnox/crypto-utils';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const config = await prisma.displayProviderConfig.findFirst({
      where: { provider: 'VNNOX' },
      include: {
        screens: true,
      },
    });

    if (!config) {
      return NextResponse.json({ config: null });
    }

    // Never expose full secret
    return NextResponse.json({
      config: {
        ...config,
        appKey: config.appKey.substring(0, 8) + '...',
        appSecretEncrypted: '***',
        hasSecret: !!config.appSecretEncrypted,
      },
    });
  } catch (error) {
    console.error('[VNNOX Config GET]', error);
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { baseUrl, appKey, appSecret, defaultPlayerId, isActive } = body;

    const existing = await prisma.displayProviderConfig.findFirst({
      where: { provider: 'VNNOX' },
    });

    const data: any = {};
    if (baseUrl !== undefined) data.baseUrl = baseUrl;
    if (appKey !== undefined) data.appKey = appKey;
    if (appSecret !== undefined && appSecret !== '') {
      data.appSecretEncrypted = encrypt(appSecret);
    }
    if (defaultPlayerId !== undefined) data.defaultPlayerId = defaultPlayerId;
    if (isActive !== undefined) data.isActive = isActive;

    let config;
    if (existing) {
      config = await prisma.displayProviderConfig.update({
        where: { id: existing.id },
        data,
      });
    } else {
      if (!appKey || !appSecret) {
        return NextResponse.json({ error: 'AppKey y AppSecret son obligatorios para la primera configuración' }, { status: 400 });
      }
      config = await prisma.displayProviderConfig.create({
        data: {
          provider: 'VNNOX',
          baseUrl: baseUrl || 'https://open-au.vnnox.com',
          appKey,
          appSecretEncrypted: encrypt(appSecret),
          defaultPlayerId: defaultPlayerId || null,
          isActive: isActive ?? true,
        },
      });
    }

    await registrarAuditoria(
      (session as any).id,
      'VNNOX_CONFIG_UPDATE',
      'DisplayProviderConfig',
      config.id,
      { action: existing ? 'update' : 'create', fieldsModified: Object.keys(data) }
    );

    return NextResponse.json({
      config: {
        ...config,
        appKey: config.appKey.substring(0, 8) + '...',
        appSecretEncrypted: '***',
        hasSecret: true,
      },
    });
  } catch (error) {
    console.error('[VNNOX Config POST]', error);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
