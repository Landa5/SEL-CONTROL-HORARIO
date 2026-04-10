/**
 * VNNOX Drafts API
 * GET  — List drafts with filters
 * POST — Create new draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validatePrices } from '@/lib/vnnox/creative-renderer';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'OFICINA'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {};
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [drafts, total] = await Promise.all([
      prisma.displayDraft.findMany({
        where,
        include: {
          screen: true,
          assets: true,
          _count: { select: { logs: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.displayDraft.count({ where }),
    ]);

    return NextResponse.json({ drafts, total, page, pageSize });
  } catch (error) {
    console.error('[VNNOX Drafts GET]', error);
    return NextResponse.json({ error: 'Error al obtener borradores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'OFICINA'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const {
      screenId,
      type = 'MIXED',
      priceDiesel,
      priceGasolina,
      priceDieselPlus,
      priceAdBlue,
      showAdBlue = false,
      promoTitle,
      promoText,
      messageText,
      templateId = 'default',
      scheduleJson,
      brightnessPlanJson,
      screenStatusPlanJson,
    } = body;

    // Validate screen exists
    if (!screenId) {
      // Find default screen
      const config = await prisma.displayProviderConfig.findFirst({
        where: { provider: 'VNNOX', isActive: true },
      });
      if (!config?.defaultPlayerId) {
        return NextResponse.json({ error: 'No hay pantalla seleccionada. Selecciona un player primero.' }, { status: 400 });
      }
      const screen = await prisma.displayScreen.findFirst({
        where: { playerId: config.defaultPlayerId },
      });
      if (!screen) {
        return NextResponse.json({ error: 'Player por defecto no encontrado en la BD' }, { status: 400 });
      }
      body.screenId = screen.id;
    }

    // Validate prices if provided
    const hasPrices = priceDiesel || priceGasolina || priceDieselPlus || (showAdBlue && priceAdBlue);
    if (hasPrices) {
      const validation = validatePrices({
        diesel: priceDiesel ? parseFloat(priceDiesel) : null,
        gasolina: priceGasolina ? parseFloat(priceGasolina) : null,
        dieselPlus: priceDieselPlus ? parseFloat(priceDieselPlus) : null,
        adBlue: priceAdBlue ? parseFloat(priceAdBlue) : null,
        showAdBlue: !!showAdBlue,
      });
      if (!validation.valid) {
        return NextResponse.json({ error: 'Errores de validación', details: validation.errors }, { status: 400 });
      }
    }

    const draft = await prisma.displayDraft.create({
      data: {
        screenId: body.screenId || screenId,
        type: type as any,
        status: 'DRAFT',
        priceDiesel: priceDiesel ? parseFloat(priceDiesel) : null,
        priceGasolina: priceGasolina ? parseFloat(priceGasolina) : null,
        priceDieselPlus: priceDieselPlus ? parseFloat(priceDieselPlus) : null,
        priceAdBlue: priceAdBlue ? parseFloat(priceAdBlue) : null,
        showAdBlue: !!showAdBlue,
        promoTitle: promoTitle || null,
        promoText: promoText || null,
        messageText: messageText || null,
        templateId: templateId || 'default',
        scheduleJson: scheduleJson || null,
        brightnessPlanJson: brightnessPlanJson || null,
        screenStatusPlanJson: screenStatusPlanJson || null,
        createdByUserId: (session as any).id,
      },
      include: {
        screen: true,
      },
    });

    await registrarAuditoria(
      (session as any).id,
      'VNNOX_DRAFT_CREATE',
      'DisplayDraft',
      draft.id,
      { type, templateId }
    );

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[VNNOX Drafts POST]', error);
    return NextResponse.json({ error: 'Error al crear borrador' }, { status: 500 });
  }
}
