import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { turnoId, cantidad } = body;

        if (!turnoId || cantidad === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (turnoId, cantidad)' }, { status: 400 });
        }

        // Update the total count directly on the usage record
        const usoCamion = await prisma.usoCamion.update({
            where: { id: parseInt(turnoId) },
            data: {
                descargasCount: parseInt(cantidad)
            }
        });

        return NextResponse.json(usoCamion);
    } catch (error) {
        console.error('POST /api/descargas error:', error);
        return NextResponse.json({ error: 'Error al actualizar contador de descargas' }, { status: 500 });
    }
}
