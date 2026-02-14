
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || user.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '1');
        const skip = (page - 1) * limit;

        const logs = await prisma.auditoria.findMany({
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nombre: true,
                        apellidos: true,
                        rol: true
                    }
                }
            }
        });

        const total = await prisma.auditoria.count();

        return NextResponse.json({
            data: logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('GET /api/admin/auditoria error:', error);
        return NextResponse.json({ error: 'Error al obtener auditoría' }, { status: 500 });
    }
}
