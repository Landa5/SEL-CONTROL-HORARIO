/**
 * GET /api/vnnox/images/[id]
 * 
 * Sirve la imagen PNG para un draft de display (sin autenticación).
 * Usa next/og ImageResponse (Satori + resvg-wasm integrados).
 * VNNOX descarga desde esta URL pública.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';

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

        // Formatear precios
        const fmtPrice = (v: number | null | undefined) => {
            if (v == null) return '—';
            return v.toFixed(3).replace('.', ',');
        };

        const fuels: { label: string; price: string; color: string }[] = [
            { label: 'DIÉSEL', price: fmtPrice(draft.priceDiesel), color: '#1a1a1a' },
            { label: 'GASOLINA', price: fmtPrice(draft.priceGasolina), color: '#16a34a' },
            { label: 'DIÉSEL+', price: fmtPrice(draft.priceDieselPlus), color: '#1e3a5f' },
        ];

        if (draft.showAdBlue && draft.priceAdBlue) {
            fuels.push({ label: 'ADBLUE', price: fmtPrice(draft.priceAdBlue), color: '#06b6d4' });
        }

        const rowHeight = Math.floor((height - 4) / fuels.length); // -4 for top bar + bottom margin
        const now = new Date();
        const timestamp = `${now.getDate()}/${now.getMonth() + 1} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

        // ImageResponse genera PNG automáticamente (Satori → resvg-wasm → PNG)
        return new ImageResponse(
            (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                    fontFamily: 'Arial, sans-serif',
                    position: 'relative',
                }}>
                    {/* Barra azul superior */}
                    <div style={{ display: 'flex', width: '100%', height: '2px', background: '#2563eb' }} />

                    {/* Filas de combustible */}
                    {fuels.map((fuel, i) => (
                        <div key={fuel.label} style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            height: `${rowHeight}px`,
                            padding: '2px 4px',
                            borderBottom: i < fuels.length - 1 ? '1px solid rgba(71,85,105,0.15)' : 'none',
                        }}>
                            {/* Barra de color lateral */}
                            <div style={{
                                display: 'flex',
                                width: '4px',
                                height: `${Math.floor(rowHeight * 0.65)}px`,
                                borderRadius: '2px',
                                background: fuel.color,
                                marginRight: '4px',
                            }} />

                            {/* Contenido */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                flex: 1,
                            }}>
                                <span style={{
                                    fontSize: `${Math.max(7, Math.floor(rowHeight * 0.22))}px`,
                                    color: '#475569',
                                    fontWeight: 700,
                                    letterSpacing: '0.5px',
                                }}>
                                    {fuel.label}
                                </span>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'baseline',
                                }}>
                                    <span style={{
                                        fontSize: `${Math.max(14, Math.floor(rowHeight * 0.55))}px`,
                                        color: '#0f172a',
                                        fontWeight: 800,
                                    }}>
                                        {fuel.price}
                                    </span>
                                    <span style={{
                                        fontSize: `${Math.max(7, Math.floor(rowHeight * 0.25))}px`,
                                        color: '#475569',
                                        fontWeight: 600,
                                        marginLeft: '2px',
                                    }}>
                                        €/L
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Timestamp */}
                    <div style={{
                        display: 'flex',
                        position: 'absolute',
                        bottom: '1px',
                        right: '3px',
                        fontSize: '5px',
                        color: 'rgba(71,85,105,0.35)',
                    }}>
                        {timestamp}
                    </div>
                </div>
            ),
            {
                width,
                height,
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    } catch (error) {
        console.error('GET /api/vnnox/images/[id] error:', error);
        return NextResponse.json({ error: 'Error generando imagen: ' + (error as Error).message }, { status: 500 });
    }
}
