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
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const moduloId = searchParams.get('moduloId');
        const empleadoId = searchParams.get('empleadoId');

        const isAdmin = ['ADMIN', 'OFICINA'].includes(user.rol);

        const where: any = {};

        if (isAdmin) {
            if (moduloId) where.moduloId = parseInt(moduloId);
            if (empleadoId) where.empleadoId = parseInt(empleadoId);
        } else {
            // Employee only sees their own results
            where.empleadoId = parseInt(user.id);
            if (moduloId) where.moduloId = parseInt(moduloId);
        }

        const resultados = await prisma.resultadoFormacion.findMany({
            where,
            include: {
                modulo: { select: { titulo: true, duracionEstimada: true } },
                empleado: { select: { nombre: true, apellidos: true, rol: true } }
            },
            orderBy: { completadoAl: 'desc' }
        });

        return NextResponse.json(resultados);
    } catch (error) {
        console.error('GET /api/formacion/resultados error:', error);
        return NextResponse.json({ error: 'Error al obtener resultados' }, { status: 500 });
    }
}
