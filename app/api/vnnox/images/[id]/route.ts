/**
 * GET /api/vnnox/images/[id]
 * 
 * Sirve la imagen PNG renderizada para un draft de display (sin autenticación).
 * VNNOX necesita una URL pública HTTPS con imagen PNG para descargar.
 * Usa sharp (incluido en Next.js) para convertir SVG → PNG.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToSvg } from '@/lib/vnnox/creative-renderer';
import sharp from 'sharp';

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

        const width = draft.screen.resolutionWidth || 128;
        const height = draft.screen.resolutionHeight || 128;

        const svgContent = renderToSvg({
            width,
            height,
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

        // Convertir SVG a PNG usando sharp (incluido en Next.js, funciona en Vercel)
        const pngBuffer = await sharp(Buffer.from(svgContent))
            .resize(width, height)
            .png()
            .toBuffer();

        console.log(`[VNNOX IMG] Draft ${draftId}: SVG→PNG ${pngBuffer.length} bytes`);

        return new NextResponse(pngBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': pngBuffer.length.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('GET /api/vnnox/images/[id] error:', error);
        return NextResponse.json({ error: 'Error generando imagen: ' + (error as Error).message }, { status: 500 });
    }
}
