import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();

        if (!body.mensaje) {
            return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
        }

        const tareaId = Number(id);

        // Check access
        const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
        if (!tarea) return NextResponse.json({ error: 'No existe' }, { status: 404 });

        const userRole = session.rol as string;
        const isStaff = ['ADMIN', 'MECANICO', 'OFICINA'].includes(userRole);
        const isOwner = tarea.creadoPorId === Number(session.id);
        const isAssigned = tarea.asignadoAId === Number(session.id);

        if (!isStaff && !isOwner && !isAssigned) {
            return NextResponse.json({ error: 'No tienes permiso para comentar aquí' }, { status: 403 });
        }

        const historial = await prisma.tareaHistorial.create({
            data: {
                tareaId: tareaId,
                autorId: Number(session.id),
                tipoAccion: body.tipoAccion || 'COMENTARIO',
                mensaje: body.mensaje
            },
            include: {
                autor: { select: { nombre: true, rol: true } }
            }
        });

        return NextResponse.json(historial);

    } catch (error) {
        return NextResponse.json({ error: 'Error agregando comentario' }, { status: 500 });
    }
}
