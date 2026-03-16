import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { RolParticipacion } from '@prisma/client';

// GET /api/tareas/[id]/participantes - Listar participantes
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const participantes = await prisma.tareaParticipante.findMany({
            where: { tareaId: Number(id) },
            include: {
                empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(participantes);
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// POST /api/tareas/[id]/participantes - Añadir participante
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await request.json();
        const { empleadoId, rolParticipacion, notificar } = body;

        if (!empleadoId || !rolParticipacion) {
            return NextResponse.json({ error: 'empleadoId y rolParticipacion son obligatorios' }, { status: 400 });
        }

        if (!Object.values(RolParticipacion).includes(rolParticipacion)) {
            return NextResponse.json({ error: 'rolParticipacion no válido' }, { status: 400 });
        }

        const participante = await prisma.tareaParticipante.upsert({
            where: {
                tareaId_empleadoId: { tareaId: Number(id), empleadoId: Number(empleadoId) }
            },
            update: { rolParticipacion, notificar: notificar !== false },
            create: {
                tareaId: Number(id),
                empleadoId: Number(empleadoId),
                rolParticipacion,
                notificar: notificar !== false,
            },
            include: {
                empleado: { select: { id: true, nombre: true, rol: true } }
            }
        });

        return NextResponse.json(participante);
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// DELETE /api/tareas/[id]/participantes - Eliminar participante
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const empleadoId = searchParams.get('empleadoId');

        if (!empleadoId) {
            return NextResponse.json({ error: 'empleadoId es obligatorio' }, { status: 400 });
        }

        await prisma.tareaParticipante.delete({
            where: {
                tareaId_empleadoId: { tareaId: Number(id), empleadoId: Number(empleadoId) }
            }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
