import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const body = await request.json();
        const { turnoId, cantidad } = body;

        if (!turnoId || cantidad === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (turnoId, cantidad)' }, { status: 400 });
        }

        // Update the total trip count (viajesCount) directly on the usage record
        const usoCamion = await prisma.usoCamion.update({
            where: { id: parseInt(turnoId) },
            data: {
                viajesCount: parseInt(cantidad)
            }
        });

        return NextResponse.json(usoCamion);
    } catch (error) {
        console.error('POST /api/viajes error:', error);
        return NextResponse.json({ error: 'Error al actualizar contador de viajes' }, { status: 500 });
    }
}
