import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth'; // Ensure this path is correct
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const empleadoId = searchParams.get('empleadoId');
        const periodo = searchParams.get('periodo');

        // Build filter
        const whereClause: any = {};
        if (empleadoId) whereClause.empleadoId = parseInt(empleadoId);
        if (periodo) whereClause.periodo = periodo;

        const evaluaciones = await prisma.evaluacion.findMany({
            where: whereClause,
            include: {
                empleado: {
                    select: { id: true, nombre: true, apellidos: true } // Avoid fetching large data
                },
                evaluador: {
                    select: { id: true, nombre: true, apellidos: true }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        return NextResponse.json(evaluaciones);
    } catch (error: any) {
        console.error("GET /api/admin/evaluaciones Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { empleadoId, periodo, comentarios, objetivos, puntuacionGeneral } = body;

        // Basic validation
        if (!empleadoId || !periodo) {
            return NextResponse.json({ error: 'Faltan datos obligatorios (empleadoId, periodo)' }, { status: 400 });
        }

        const nuevaEvaluacion = await prisma.evaluacion.create({
            data: {
                empleadoId: parseInt(empleadoId),
                periodo,
                evaluadorId: user.id, // Current logged in user
                comentarios, // Optional
                objetivos,   // Optional
                puntuacionGeneral: puntuacionGeneral || 0,
                fecha: new Date(),
                estado: 'BORRADOR'
            }
        });

        return NextResponse.json(nuevaEvaluacion);

    } catch (error: any) {
        console.error("POST /api/admin/evaluaciones Error:", error);
        // Handle unique constraint violation (one evaluation per employee per period)
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe una evaluación para este empleado en este periodo.' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const body = await request.json();
        const { id, puntuacionGeneral, comentarios, objetivos, estado } = body;

        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        const existing = await prisma.evaluacion.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });

        const updated = await prisma.evaluacion.update({
            where: { id: parseInt(id) },
            data: {
                puntuacionGeneral,
                comentarios,
                objetivos,
                estado
            }
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('PUT /api/admin/evaluaciones error:', error);
        return NextResponse.json({ error: 'Error al actualizar evaluación' }, { status: 500 });
    }
}
