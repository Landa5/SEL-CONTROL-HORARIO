/**
 * VNNOX Test Connection API
 * POST — Test connection to VNNOX API
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VnnoxClient } from '@/lib/vnnox/vnnox-client';
import { registrarAuditoria } from '@/lib/auditoria';
import { decrypt } from '@/lib/vnnox/crypto-utils';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const config = await prisma.displayProviderConfig.findFirst({
      where: { provider: 'VNNOX', isActive: true },
    });

    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'No hay configuración VNNOX activa. Configura las credenciales primero.',
      }, { status: 400 });
    }

    const appSecret = decrypt(config.appSecretEncrypted);
    if (!appSecret) {
      return NextResponse.json({
        success: false,
        message: 'Error al descifrar AppSecret. Vuelve a guardar las credenciales.',
      }, { status: 400 });
    }

    const client = new VnnoxClient({
      baseUrl: config.baseUrl,
      appKey: config.appKey,
      appSecret,
    });

    const result = await client.testConnection();

    // Update last check status
    await prisma.displayProviderConfig.update({
      where: { id: config.id },
      data: {
        lastConnectionCheckAt: new Date(),
        lastConnectionStatus: result.success ? 'OK' : 'ERROR',
      },
    });

    // Log the test
    await prisma.displayPublicationLog.create({
      data: {
        draftId: 0, // No draft associated
        action: 'TEST_CONNECTION',
        requestPayloadJson: { baseUrl: config.baseUrl, appKey: config.appKey.substring(0, 8) + '...' },
        responsePayloadJson: { success: result.success, message: result.message },
        success: result.success,
        errorMessage: result.success ? null : result.message,
        performedByUserId: (session as any).id,
      },
    }).catch(() => {
      // Log creation may fail if no draft exists — that's OK for test connections
      console.warn('[VNNOX] Could not create log entry for test connection (no draftId)');
    });

    await registrarAuditoria(
      (session as any).id,
      'VNNOX_TEST_CONNECTION',
      'DisplayProviderConfig',
      config.id,
      { success: result.success, message: result.message }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[VNNOX Test Connection]', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
