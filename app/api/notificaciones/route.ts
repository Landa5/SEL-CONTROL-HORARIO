import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET /api/notificaciones - Listar notificaciones del usuario
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const soloNoLeidas = searchParams.get('noLeidas') === 'true';
        const limit = Number(searchParams.get('limit') || '20');

        const where: any = { usuarioId: Number(session.id) };
        if (soloNoLeidas) {
            where.readAt = null;
        }

        const [notificaciones, countNoLeidas] = await Promise.all([
            prisma.notificacion.findMany({
                where,
                include: {
                    actor: { select: { nombre: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
            }),
            prisma.notificacion.count({
                where: { usuarioId: Number(session.id), readAt: null }
            })
        ]);

        return NextResponse.json({
            notificaciones,
            noLeidas: countNoLeidas,
        });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PATCH /api/notificaciones - Marcar como leídas (bulk)
export async function PATCH(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await request.json();
        const { ids, marcarTodas } = body;
        const now = new Date();

        if (marcarTodas) {
            await prisma.notificacion.updateMany({
                where: { usuarioId: Number(session.id), readAt: null },
                data: { leida: true, readAt: now }
            });
        } else if (ids && Array.isArray(ids)) {
            await prisma.notificacion.updateMany({
                where: {
                    id: { in: ids.map(Number) },
                    usuarioId: Number(session.id),
                },
                data: { leida: true, readAt: now }
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
