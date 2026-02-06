import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { turnoId, litros } = body;

        if (!turnoId || litros === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (turnoId, litros)' }, { status: 400 });
        }

        // Update the refueled liters directly on the usage record
        const usoCamion = await prisma.usoCamion.update({
            where: { id: parseInt(turnoId) },
            data: {
                litrosRepostados: parseFloat(litros)
            }
        });

        return NextResponse.json(usoCamion);
    } catch (error) {
        console.error('POST /api/repostaje error:', error);
        return NextResponse.json({ error: 'Error al registrar repostaje' }, { status: 500 });
    }
}
