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

    // Note: test connection is logged via registrarAuditoria below.
    // DisplayPublicationLog requires a valid draftId, so we skip it for test connections.

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
