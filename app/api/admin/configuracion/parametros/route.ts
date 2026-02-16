
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        let config = await prisma.configuracionNegocio.findFirst();

        if (!config) {
            config = await prisma.configuracionNegocio.create({
                data: {} // Use defaults
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error fetching business config:', error);
        return NextResponse.json({ error: 'Error fetching configuration' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            consumoObjetivoL100Km,
            costePorKm,
            alertaMantenimientoKm,
            cortesiaPuntualidadMin,
            limiteHorasExtraMensual,
            costeHoraExtraReferencia,
            tiempoObjetivoCargaDescargaMin
        } = body;

        // Validation could go here

        const config = await prisma.configuracionNegocio.findFirst();
        let updatedConfig;

        if (config) {
            updatedConfig = await prisma.configuracionNegocio.update({
                where: { id: config.id },
                data: {
                    consumoObjetivoL100Km: Number(consumoObjetivoL100Km),
                    costePorKm: Number(costePorKm),
                    alertaMantenimientoKm: Number(alertaMantenimientoKm),
                    cortesiaPuntualidadMin: Number(cortesiaPuntualidadMin),
                    limiteHorasExtraMensual: Number(limiteHorasExtraMensual),
                    costeHoraExtraReferencia: Number(costeHoraExtraReferencia),
                    tiempoObjetivoCargaDescargaMin: Number(tiempoObjetivoCargaDescargaMin),
                }
            });
        } else {
            // Should theoretically not happen if GET is called first, but good for safety
            updatedConfig = await prisma.configuracionNegocio.create({
                data: {
                    consumoObjetivoL100Km: Number(consumoObjetivoL100Km),
                    costePorKm: Number(costePorKm),
                    alertaMantenimientoKm: Number(alertaMantenimientoKm),
                    cortesiaPuntualidadMin: Number(cortesiaPuntualidadMin),
                    limiteHorasExtraMensual: Number(limiteHorasExtraMensual),
                    costeHoraExtraReferencia: Number(costeHoraExtraReferencia),
                    tiempoObjetivoCargaDescargaMin: Number(tiempoObjetivoCargaDescargaMin),
                }
            });
        }

        return NextResponse.json(updatedConfig);

    } catch (error) {
        console.error('Error updating business config:', error);
        return NextResponse.json({ error: 'Error updating configuration' }, { status: 500 });
    }
}
