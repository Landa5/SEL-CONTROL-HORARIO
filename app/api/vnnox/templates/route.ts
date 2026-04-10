/**
 * VNNOX Templates API
 * GET — List available templates
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTemplateList, renderToHtmlPreview } from '@/lib/vnnox/creative-renderer';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'OFICINA'].includes((session as any).rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const templates = getTemplateList();

    // Generate mini previews for each template
    const templatesWithPreviews = templates.map(t => ({
      ...t,
      preview: renderToHtmlPreview({
        width: 480,
        height: 270,
        templateId: t.id,
        prices: {
          diesel: 1.459,
          gasolina: 1.619,
          dieselPlus: 1.539,
          adBlue: 0.599,
          showAdBlue: true,
        },
        promo: { title: '¡OFERTA!', text: 'Descuento especial' },
        message: { text: 'Estación de Servicio SEL' },
      }),
    }));

    return NextResponse.json({ templates: templatesWithPreviews });
  } catch (error) {
    console.error('[VNNOX Templates GET]', error);
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
  }
}
