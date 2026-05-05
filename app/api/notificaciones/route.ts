import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET — Fetch notifications for the current user
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = Number(session.id);
        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = parseInt(searchParams.get('limit') || '20');

        const where: any = { usuarioId: userId };
        if (unreadOnly) {
            where.readAt = null;
        }

        const [notificaciones, noLeidas] = await Promise.all([
            prisma.notificacion.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                include: {
                    actor: {
                        select: { nombre: true, apellidos: true }
                    }
                }
            }),
            prisma.notificacion.count({
                where: { usuarioId: userId, readAt: null }
            })
        ]);

        // Devolver con ambos formatos para compatibilidad con los dos NotificationBell
        return NextResponse.json({
            notificaciones,
            noLeidas,
            // Aliases para componente admin que usa nombres en inglés
            notifications: notificaciones,
            unreadCount: noLeidas,
        });
    } catch (error) {
        console.error('GET /api/notificaciones error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PATCH — Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = Number(session.id);
        const body = await request.json();
        // Aceptar ambos nombres: markAll (admin) y marcarTodas (tareas)
        const { ids, markAll, marcarTodas } = body;

        if (markAll || marcarTodas) {
            await prisma.notificacion.updateMany({
                where: { usuarioId: userId, readAt: null },
                data: { readAt: new Date(), leida: true }
            });
        } else if (ids && Array.isArray(ids)) {
            await prisma.notificacion.updateMany({
                where: { id: { in: ids }, usuarioId: userId },
                data: { readAt: new Date(), leida: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/notificaciones error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

