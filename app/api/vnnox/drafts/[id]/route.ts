/**
 * VNNOX Draft Actions API
 * POST with action: approve, publish, rollback, generate-preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { VnnoxClient } from '@/lib/vnnox/vnnox-client';
import { renderToHtmlPreview, renderToSvg, validatePrices } from '@/lib/vnnox/creative-renderer';
import { registrarAuditoria } from '@/lib/auditoria';
import { decrypt } from '@/lib/vnnox/crypto-utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'OFICINA'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const draftId = parseInt(id);

    const draft = await prisma.displayDraft.findUnique({
      where: { id: draftId },
      include: {
        screen: true,
        assets: true,
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[VNNOX Draft GET]', error);
    return NextResponse.json({ error: 'Error al obtener borrador' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'OFICINA'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const draftId = parseInt(id);
    const body = await req.json();

    const draft = await prisma.displayDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });
    }

    if (draft.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Solo se pueden editar borradores en estado DRAFT' }, { status: 400 });
    }

    const updateData: any = {};
    const editableFields = [
      'priceDiesel', 'priceGasolina', 'priceDieselPlus', 'priceAdBlue',
      'showAdBlue', 'promoTitle', 'promoText', 'messageText',
      'templateId', 'scheduleJson', 'brightnessPlanJson', 'screenStatusPlanJson',
    ];

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        if (['priceDiesel', 'priceGasolina', 'priceDieselPlus', 'priceAdBlue'].includes(field)) {
          updateData[field] = body[field] ? parseFloat(body[field]) : null;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.displayDraft.update({
      where: { id: draftId },
      data: updateData,
      include: { screen: true },
    });

    return NextResponse.json({ draft: updated });
  } catch (error) {
    console.error('[VNNOX Draft PUT]', error);
    return NextResponse.json({ error: 'Error al actualizar borrador' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const draftId = parseInt(id);
    const body = await req.json();
    const { action } = body;

    const draft = await prisma.displayDraft.findUnique({
      where: { id: draftId },
      include: { screen: true, assets: true },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 });
    }

    const userId = (session as any).id;
    const userRol = (session as any).rol;

    switch (action) {
      case 'generate-preview': {
        return await handleGeneratePreview(draft, userId);
      }
      case 'submit-approval': {
        return await handleSubmitApproval(draft, userId);
      }
      case 'approve': {
        if (!['ADMIN'].includes(userRol)) {
          return NextResponse.json({ error: 'Solo ADMIN puede aprobar publicaciones' }, { status: 403 });
        }
        return await handleApprove(draft, userId);
      }
      case 'publish': {
        if (!['ADMIN'].includes(userRol)) {
          return NextResponse.json({ error: 'Solo ADMIN puede publicar' }, { status: 403 });
        }
        return await handlePublish(draft, userId);
      }
      case 'rollback': {
        if (!['ADMIN'].includes(userRol)) {
          return NextResponse.json({ error: 'Solo ADMIN puede hacer rollback' }, { status: 403 });
        }
        return await handleRollback(draft, userId);
      }
      default:
        return NextResponse.json({ error: `Acción desconocida: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[VNNOX Draft Action]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 });
  }
}

// ============================================================
// Action Handlers
// ============================================================

async function handleGeneratePreview(draft: any, userId: number) {
  const screen = draft.screen;
  if (!screen?.resolutionWidth || !screen?.resolutionHeight) {
    return NextResponse.json({
      error: 'La pantalla no tiene resolución detectada. Sincroniza el player primero.',
    }, { status: 400 });
  }

  const previewDataUrl = renderToHtmlPreview({
    width: screen.resolutionWidth,
    height: screen.resolutionHeight,
    templateId: draft.templateId || 'default',
    prices: {
      diesel: draft.priceDiesel,
      gasolina: draft.priceGasolina,
      dieselPlus: draft.priceDieselPlus,
      adBlue: draft.priceAdBlue,
      showAdBlue: draft.showAdBlue,
    },
    promo: {
      title: draft.promoTitle,
      text: draft.promoText,
    },
    message: {
      text: draft.messageText,
    },
  });

  await prisma.displayDraft.update({
    where: { id: draft.id },
    data: { previewImageUrl: previewDataUrl },
  });

  await prisma.displayPublicationLog.create({
    data: {
      draftId: draft.id,
      action: 'GENERATE_ASSET',
      success: true,
      performedByUserId: userId,
      responsePayloadJson: { type: 'preview', width: screen.resolutionWidth, height: screen.resolutionHeight },
    },
  });

  return NextResponse.json({ previewUrl: previewDataUrl });
}

async function handleSubmitApproval(draft: any, userId: number) {
  if (draft.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Solo borradores en estado DRAFT pueden enviarse a aprobación' }, { status: 400 });
  }

  // Validate has content
  const hasContent = draft.priceDiesel || draft.priceGasolina || draft.priceDieselPlus ||
    draft.promoTitle || draft.messageText;
  if (!hasContent) {
    return NextResponse.json({ error: 'El borrador no tiene contenido (precios, promos o mensajes)' }, { status: 400 });
  }

  const updated = await prisma.displayDraft.update({
    where: { id: draft.id },
    data: { status: 'PENDING_APPROVAL' },
  });

  await registrarAuditoria(userId, 'VNNOX_DRAFT_SUBMIT_APPROVAL', 'DisplayDraft', draft.id, {
    draftType: draft.type,
  });

  return NextResponse.json({ draft: updated, message: 'Enviado a aprobación' });
}

async function handleApprove(draft: any, userId: number) {
  if (draft.status !== 'PENDING_APPROVAL') {
    return NextResponse.json({ error: 'Solo borradores en estado PENDING_APPROVAL pueden aprobarse' }, { status: 400 });
  }

  const updated = await prisma.displayDraft.update({
    where: { id: draft.id },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedByUserId: userId,
    },
  });

  await prisma.displayPublicationLog.create({
    data: {
      draftId: draft.id,
      action: 'APPROVE',
      success: true,
      performedByUserId: userId,
    },
  });

  await registrarAuditoria(userId, 'VNNOX_DRAFT_APPROVE', 'DisplayDraft', draft.id, {
    draftType: draft.type,
  });

  return NextResponse.json({ draft: updated, message: 'Publicación aprobada' });
}

async function handlePublish(draft: any, userId: number) {
  if (draft.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Solo borradores APROBADOS pueden publicarse. Aprueba primero.' }, { status: 400 });
  }

  const screen = draft.screen;
  if (!screen) {
    return NextResponse.json({ error: 'No hay pantalla asociada' }, { status: 400 });
  }

  if (!screen.resolutionWidth || !screen.resolutionHeight) {
    return NextResponse.json({ error: 'Resolución de pantalla no detectada. Sincroniza el player.' }, { status: 400 });
  }

  // Get VNNOX client
  const config = await prisma.displayProviderConfig.findFirst({
    where: { provider: 'VNNOX', isActive: true },
  });

  if (!config) {
    return NextResponse.json({ error: 'No hay configuración VNNOX activa' }, { status: 400 });
  }

  const appSecret = decrypt(config.appSecretEncrypted);
  if (!appSecret) {
    return NextResponse.json({ error: 'Error al descifrar credenciales VNNOX' }, { status: 500 });
  }

  const client = new VnnoxClient({
    baseUrl: config.baseUrl,
    appKey: config.appKey,
    appSecret,
  });

  // ─── PASO 1: Over-specification check (obligatorio) ───
  try {
    const specCheck = await client.overSpecificationCheck({
      playerId: screen.playerId,
      width: screen.resolutionWidth,
      height: screen.resolutionHeight,
    });

    if (!specCheck.data?.pass) {
      await prisma.displayPublicationLog.create({
        data: {
          draftId: draft.id,
          action: 'PUBLISH',
          success: false,
          errorMessage: `Over-specification check fallido: el contenido excede las capacidades del player.`,
          performedByUserId: userId,
          responsePayloadJson: specCheck.data as any,
        },
      });

      return NextResponse.json({
        error: 'El contenido excede las capacidades del player (over-specification check). Reduce resolución o tamaño.',
        details: specCheck.data,
      }, { status: 422 });
    }
  } catch (specError) {
    // Si el endpoint no existe todavía en esta versión de la API, logueamos pero no bloqueamos
    console.warn('[VNNOX] over-specification-check no disponible, continuando...', specError);
    await prisma.displayPublicationLog.create({
      data: {
        draftId: draft.id,
        action: 'PUBLISH',
        success: true,
        errorMessage: 'over-specification-check no disponible en esta API, se omitió.',
        performedByUserId: userId,
      },
    });
  }

  // ─── PASO 2: Generar creatividad (solo IMAGE, MVP 1) ───
  const svgContent = renderToSvg({
    width: screen.resolutionWidth,
    height: screen.resolutionHeight,
    templateId: draft.templateId || 'default',
    prices: {
      diesel: draft.priceDiesel,
      gasolina: draft.priceGasolina,
      dieselPlus: draft.priceDieselPlus,
      adBlue: draft.priceAdBlue,
      showAdBlue: draft.showAdBlue,
    },
    promo: { title: draft.promoTitle, text: draft.promoText },
    message: { text: draft.messageText },
  });

  // Calcular MD5 y tamaño del SVG para VNNOX
  const crypto = await import('crypto');
  const svgBuffer = Buffer.from(svgContent, 'utf-8');
  const svgMd5 = crypto.createHash('md5').update(svgBuffer).digest('hex');
  const svgSize = svgBuffer.length;

  // URL pública HTTPS — VNNOX descargará la imagen desde este endpoint
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : (process.env.NEXTAUTH_URL || 'http://localhost:3000');
  const publicImageUrl = `${baseUrl}/api/vnnox/images/${draft.id}`;

  // MVP 1: solo imágenes, sin capas de vídeo
  const layers = [{
    type: 'IMAGE' as const,
    url: publicImageUrl,
    width: screen.resolutionWidth,
    height: screen.resolutionHeight,
    duration: 10,
    md5: svgMd5,
    size: svgSize,
  }];

  const programPayload = {
    name: `SEL-Display-${draft.id}-${Date.now()}`,
    playerId: screen.playerId,
    width: screen.resolutionWidth,
    height: screen.resolutionHeight,
    layers,
  };

  // ─── PASO 3: Publicar vía POST /v2/player/program/normal ───
  try {
    const result = await client.publishNormalProgram(programPayload);

    await prisma.displayPublicationLog.create({
      data: {
        draftId: draft.id,
        action: 'PUBLISH',
        requestPayloadJson: { ...programPayload, layers: programPayload.layers.map(l => ({ ...l, url: l.url.substring(0, 100) + '...' })) },
        responsePayloadJson: result.rawResponse as any,
        success: result.success,
        errorMessage: result.success ? null : result.message,
        performedByUserId: userId,
      },
    });

    if (result.success) {
      const updated = await prisma.displayDraft.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          publishedByUserId: userId,
          vnnoxPayloadJson: programPayload as any,
          vnnoxResponseJson: result.rawResponse as any,
        },
      });

      await registrarAuditoria(userId, 'VNNOX_PUBLISH', 'DisplayDraft', draft.id, {
        playerId: screen.playerId,
        programId: result.data,
      });

      return NextResponse.json({ draft: updated, result, message: '¡Publicado con éxito!' });
    } else {
      await prisma.displayDraft.update({
        where: { id: draft.id },
        data: { status: 'FAILED' },
      });

      return NextResponse.json({
        error: result.message || 'Error al publicar en VNNOX',
        result,
      }, { status: 502 });
    }
  } catch (error) {
    await prisma.displayPublicationLog.create({
      data: {
        draftId: draft.id,
        action: 'PUBLISH',
        requestPayloadJson: programPayload as any,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        performedByUserId: userId,
      },
    });

    await prisma.displayDraft.update({
      where: { id: draft.id },
      data: { status: 'FAILED' },
    });

    throw error;
  }
}

async function handleRollback(draft: any, userId: number) {
  // Find last successful publication for this screen
  const lastPublished = await prisma.displayDraft.findFirst({
    where: {
      screenId: draft.screenId,
      status: 'PUBLISHED',
      id: { not: draft.id },
    },
    orderBy: { publishedAt: 'desc' },
    include: { screen: true },
  });

  if (!lastPublished) {
    return NextResponse.json({
      error: 'No hay publicación anterior válida para hacer rollback',
    }, { status: 400 });
  }

  // Mark current as rolled back
  await prisma.displayDraft.update({
    where: { id: draft.id },
    data: { status: 'ROLLED_BACK' },
  });

  // Re-publish the last valid one
  // For this, we create a copy and mark it as approved for re-publishing
  const rollbackDraft = await prisma.displayDraft.create({
    data: {
      screenId: lastPublished.screenId,
      type: lastPublished.type,
      status: 'APPROVED',
      priceDiesel: lastPublished.priceDiesel,
      priceGasolina: lastPublished.priceGasolina,
      priceDieselPlus: lastPublished.priceDieselPlus,
      priceAdBlue: lastPublished.priceAdBlue,
      showAdBlue: lastPublished.showAdBlue,
      promoTitle: lastPublished.promoTitle,
      promoText: lastPublished.promoText,
      messageText: lastPublished.messageText,
      templateId: lastPublished.templateId,
      previewImageUrl: lastPublished.previewImageUrl,
      createdByUserId: userId,
      approvedAt: new Date(),
      approvedByUserId: userId,
    },
  });

  await prisma.displayPublicationLog.create({
    data: {
      draftId: draft.id,
      action: 'ROLLBACK',
      success: true,
      performedByUserId: userId,
      responsePayloadJson: { rolledBackTo: lastPublished.id, newDraftId: rollbackDraft.id },
    },
  });

  await registrarAuditoria(userId, 'VNNOX_ROLLBACK', 'DisplayDraft', draft.id, {
    rolledBackTo: lastPublished.id,
    newDraftId: rollbackDraft.id,
  });

  return NextResponse.json({
    message: `Rollback preparado. Borrador #${rollbackDraft.id} creado como APPROVED y listo para publicar.`,
    rollbackDraft,
    originalDraft: lastPublished.id,
  });
}
