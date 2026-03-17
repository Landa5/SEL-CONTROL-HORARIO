import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { RolProyecto } from '@prisma/client';

// GET /api/proyectos/[id]/miembros
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const miembros = await prisma.proyectoMiembro.findMany({
            where: { proyectoId: Number(id) },
            include: {
                empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        return NextResponse.json(miembros);
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// POST /api/proyectos/[id]/miembros
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await request.json();
        const { empleadoId, rol } = body;

        if (!empleadoId) {
            return NextResponse.json({ error: 'empleadoId es obligatorio' }, { status: 400 });
        }

        const rolFinal = rol && Object.values(RolProyecto).includes(rol) ? rol : 'MIEMBRO';

        const miembro = await prisma.proyectoMiembro.upsert({
            where: {
                proyectoId_empleadoId: { proyectoId: Number(id), empleadoId: Number(empleadoId) }
            },
            update: { rol: rolFinal },
            create: {
                proyectoId: Number(id),
                empleadoId: Number(empleadoId),
                rol: rolFinal,
            },
            include: {
                empleado: { select: { id: true, nombre: true, rol: true } }
            }
        });

        return NextResponse.json(miembro);
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// DELETE /api/proyectos/[id]/miembros
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

        await prisma.proyectoMiembro.delete({
            where: {
                proyectoId_empleadoId: { proyectoId: Number(id), empleadoId: Number(empleadoId) }
            }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
