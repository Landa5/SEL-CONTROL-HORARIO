import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { notifyParticipantes } from '@/lib/tareas-engine';

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

        // Check access (v3.1: incluir participantes)
        const tarea = await prisma.tarea.findUnique({
            where: { id: tareaId },
            include: { participantes: { select: { empleadoId: true } } }
        });
        if (!tarea) return NextResponse.json({ error: 'No existe' }, { status: 404 });

        const userRole = session.rol as string;
        const isStaff = ['ADMIN', 'MECANICO', 'OFICINA'].includes(userRole);
        const isOwner = tarea.creadoPorId === Number(session.id);
        const isAssigned = tarea.asignadoAId === Number(session.id);
        const isParticipante = tarea.participantes.some(p => p.empleadoId === Number(session.id));

        if (!isStaff && !isOwner && !isAssigned && !isParticipante) {
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

        // v3.1: Notificar a participantes del nuevo comentario
        await notifyParticipantes({
            tareaId,
            actorId: Number(session.id),
            mensaje: `Nuevo comentario en: ${tarea.titulo}`,
            link: `/admin/tareas?id=${tareaId}`,
            tipo: 'COMENTARIO_NUEVO',
        });

        return NextResponse.json(historial);

    } catch (error) {
        return NextResponse.json({ error: 'Error agregando comentario' }, { status: 500 });
    }
}
