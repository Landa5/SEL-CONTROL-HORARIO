import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    // Wait for params to be available
    const { id } = await context.params;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const tareaId = Number(id);
        const tarea = await prisma.tarea.findUnique({
            where: { id: tareaId },
            include: {
                creadoPor: { select: { nombre: true, rol: true } },
                asignadoA: { select: { nombre: true } },
                camion: { select: { matricula: true, marca: true, modelo: true } },
                historial: {
                    include: { autor: { select: { nombre: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                adjuntos: true
            }
        });

        if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

        // Visibility Check
        const userRole = session.rol as string;
        const isStaff = ['ADMIN', 'MECANICO', 'OFICINA'].includes(userRole);
        if (!isStaff && tarea.creadoPorId !== Number(session.id) && tarea.asignadoAId !== Number(session.id)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        return NextResponse.json(tarea);

    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Only Staff can edit/manage tickets
        const userRole = session.rol as string;
        if (!['ADMIN', 'MECANICO'].includes(userRole)) {
            return NextResponse.json({ error: 'Permisos insuficientes para gestionar tareas' }, { status: 403 });
        }

        const body = await request.json();
        const tareaId = Number(id);

        const currentTarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
        if (!currentTarea) return NextResponse.json({ error: 'No existe' }, { status: 404 });

        // Validate Closure
        if (body.estado === 'CERRADA' && currentTarea.estado !== 'CERRADA') {
            if (!body.resumenCierre && !body.descripcion) {
                // Either explicit 'resumenCierre' field or we take 'descripcion' as summary if passed
                return NextResponse.json({ error: 'Para cerrar la incidencia es obligatorio un resumen' }, { status: 400 });
            }
        }

        const updateData: any = {};
        if (body.estado) updateData.estado = body.estado;
        if (body.prioridad) updateData.prioridad = body.prioridad;
        if (body.asignadoAId) updateData.asignadoAId = Number(body.asignadoAId);
        if (body.resumenCierre) updateData.resumenCierre = body.resumenCierre;
        if (body.fechaCierre) updateData.fechaCierre = body.fechaCierre; // or automatic new Date() if closed

        if (body.estado === 'CERRADA' && !currentTarea.fechaCierre) {
            updateData.fechaCierre = new Date();
        }

        const updated = await prisma.tarea.update({
            where: { id: tareaId },
            data: updateData
        });

        // Add History Log
        const changes = [];
        if (body.estado && body.estado !== currentTarea.estado) changes.push(`Estado: ${currentTarea.estado} -> ${body.estado}`);
        if (body.prioridad && body.prioridad !== currentTarea.prioridad) changes.push(`Prioridad: ${currentTarea.prioridad} -> ${body.prioridad}`);
        if (body.asignadoAId) changes.push('Asignación actualizada');
        if (body.resumenCierre) changes.push('Resumen de cierre añadido');

        if (changes.length > 0) {
            await prisma.tareaHistorial.create({
                data: {
                    tareaId: tareaId,
                    autorId: Number(session.id),
                    tipoAccion: 'CAMBIO_ESTADO',
                    mensaje: changes.join('. '),
                    estadoNuevo: body.estado || undefined
                }
            });
        }

        return NextResponse.json(updated);

    } catch (error) {
        return NextResponse.json({ error: 'Error updating' }, { status: 500 });
    }
}
