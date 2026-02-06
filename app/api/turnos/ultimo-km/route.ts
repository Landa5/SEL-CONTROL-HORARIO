import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const camionId = searchParams.get('camionId');

        if (!camionId) {
            return NextResponse.json({ error: 'camionId requerido' }, { status: 400 });
        }

        // Get the last usage for this truck
        const lastUsage = await prisma.usoCamion.findFirst({
            where: {
                camionId: parseInt(camionId),
                kmFinal: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            select: { kmFinal: true }
        });

        // If no previous usage, get the truck's current KM
        if (!lastUsage) {
            const camion = await prisma.camion.findUnique({
                where: { id: parseInt(camionId) },
                select: { kmActual: true }
            });
            return NextResponse.json({ kmSugerido: camion?.kmActual || 0 });
        }

        return NextResponse.json({ kmSugerido: lastUsage.kmFinal });
    } catch (error) {
        console.error('GET /api/turnos/ultimo-km error:', error);
        return NextResponse.json({ error: 'Error al obtener último KM' }, { status: 500 });
    }
}
