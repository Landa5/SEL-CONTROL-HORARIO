import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

async function getUserFromToken(): Promise<{ id: number; rol: string } | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;
        if (!token) return null;
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        return { id: decoded.empleadoId || decoded.id, rol: decoded.rol };
    } catch {
        return null;
    }
}

// GET — Fetch notifications for the current user
export async function GET(request: NextRequest) {
    try {
        const user = getUserFromToken();
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = parseInt(searchParams.get('limit') || '20');

        const where: any = { usuarioId: user.id };
        if (unreadOnly) {
            where.readAt = null;
        }

        const [notifications, unreadCount] = await Promise.all([
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
                where: { usuarioId: user.id, readAt: null }
            })
        ]);

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error('GET /api/notificaciones error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PATCH — Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const user = getUserFromToken();
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { ids, markAll } = body;

        if (markAll) {
            await prisma.notificacion.updateMany({
                where: { usuarioId: user.id, readAt: null },
                data: { readAt: new Date(), leida: true }
            });
        } else if (ids && Array.isArray(ids)) {
            await prisma.notificacion.updateMany({
                where: { id: { in: ids }, usuarioId: user.id },
                data: { readAt: new Date(), leida: true }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PATCH /api/notificaciones error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
