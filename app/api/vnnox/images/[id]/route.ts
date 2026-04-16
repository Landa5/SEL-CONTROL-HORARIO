/**
 * GET /api/vnnox/images/[id]
 * 
 * Sirve la imagen SVG generada para un draft de display (sin autenticación).
 * VNNOX necesita una URL pública HTTPS para descargar las imágenes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToSvg } from '@/lib/vnnox/creative-renderer';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const draftId = parseInt(id);
        if (isNaN(draftId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const draft = await prisma.displayDraft.findUnique({
            where: { id: draftId },
            include: { screen: true },
        });

        if (!draft || !draft.screen) {
            return NextResponse.json({ error: 'Draft no encontrado' }, { status: 404 });
        }

        const svgContent = renderToSvg({
            width: draft.screen.resolutionWidth,
            height: draft.screen.resolutionHeight,
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

        return new NextResponse(svgContent, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=60',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('GET /api/vnnox/images/[id] error:', error);
        return NextResponse.json({ error: 'Error generando imagen' }, { status: 500 });
    }
}
