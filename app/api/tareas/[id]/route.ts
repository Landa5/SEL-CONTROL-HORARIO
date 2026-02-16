
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TareaEstado, TareaPrioridad, TareaTipo } from '@prisma/client';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const tarea = await prisma.tarea.findUnique({
            where: { id: Number(id) },
            include: {
                creadoPor: { select: { nombre: true, rol: true } },
                asignadoA: { select: { nombre: true, rol: true } },
                camion: { select: { matricula: true, modelo: true } },
                historial: {
                    include: { autor: { select: { nombre: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                adjuntos: true,
                subtareas: {
                    include: { asignadoA: { select: { nombre: true } } }
                }
            }
        });

        if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

        return NextResponse.json(tarea);
    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const body = await request.json();

        // Fetch current state
        const currentTarea = await prisma.tarea.findUnique({ where: { id: Number(id) } });
        if (!currentTarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

        const updateData: any = {};
        let historialMensaje = '';

        // Status Change
        if (body.estado && body.estado !== currentTarea.estado) {
            updateData.estado = body.estado as TareaEstado;
            historialMensaje += `Estado cambiado a ${body.estado}. `;

            // Handle closing dates
            if (body.estado === 'COMPLETADA' || body.estado === 'CANCELADA') {
                updateData.fechaCierre = new Date();
                if (body.resumenCierre) updateData.resumenCierre = body.resumenCierre;
            }

            // Handle Bloqueo
            if (body.estado === 'BLOQUEADA') {
                if (body.motivoBloqueo) {
                    updateData.motivoBloqueo = body.motivoBloqueo;
                    historialMensaje += `Motivo: ${body.motivoBloqueo}. `;
                }
            } else {
                updateData.motivoBloqueo = null;
            }
        }

        // Priority Change
        if (body.prioridad && body.prioridad !== currentTarea.prioridad) {
            updateData.prioridad = body.prioridad as TareaPrioridad;
            historialMensaje += `Prioridad cambiada a ${body.prioridad}. `;
        }

        // Assignment Change
        if (body.asignadoAId !== undefined) {
            const newAssignee = body.asignadoAId ? Number(body.asignadoAId) : null;
            if (newAssignee !== currentTarea.asignadoAId) {
                updateData.asignadoAId = newAssignee;
                historialMensaje += `Asignación actualizada. `;
            }
        }

        // Core Fields
        if (body.titulo && body.titulo !== currentTarea.titulo) {
            updateData.titulo = body.titulo;
            historialMensaje += `Título actualizado. `;
        }
        if (body.descripcion && body.descripcion !== currentTarea.descripcion) {
            updateData.descripcion = body.descripcion;
            historialMensaje += `Descripción actualizada. `;
        }
        if (body.fechaLimite) updateData.fechaLimite = new Date(body.fechaLimite);
        if (body.tipo && body.tipo !== currentTarea.tipo) {
            updateData.tipo = body.tipo as TareaTipo;
            historialMensaje += `Tipo cambiado a ${body.tipo}. `;
        }

        // Context Fields
        if (body.activoTipo && body.activoTipo !== currentTarea.activoTipo) {
            updateData.activoTipo = body.activoTipo;
        }

        // Validar matricula y actualizar camionId si cambia
        if (body.matricula !== undefined && body.matricula !== currentTarea.matricula) {
            updateData.matricula = body.matricula;
            if (body.matricula) {
                const camion = await prisma.camion.findUnique({ where: { matricula: body.matricula } });
                updateData.camionId = camion ? camion.id : null;
            } else {
                updateData.camionId = null;
            }
            historialMensaje += `Matrícula/Activo actualizado. `;
        }

        // Other Context Fields
        if (body.clienteNombre !== undefined && body.clienteNombre !== currentTarea.clienteNombre) {
            updateData.clienteNombre = body.clienteNombre;
        }
        if (body.ubicacionTexto !== undefined && body.ubicacionTexto !== currentTarea.ubicacionTexto) {
            updateData.ubicacionTexto = body.ubicacionTexto;
        }
        if (body.contactoNombre !== undefined && body.contactoNombre !== currentTarea.contactoNombre) {
            updateData.contactoNombre = body.contactoNombre;
        }
        if (body.contactoTelefono !== undefined && body.contactoTelefono !== currentTarea.contactoTelefono) {
            updateData.contactoTelefono = body.contactoTelefono;
        }
        if (body.descargas !== undefined && Number(body.descargas) !== currentTarea.descargas) {
            updateData.descargas = Number(body.descargas);
        }

        // Update
        const updatedTarea = await prisma.tarea.update({
            where: { id: Number(id) },
            data: updateData
        });

        // Add History if meaningful change
        const fullMessage = (historialMensaje + (body.comentario ? ` Comentario: ${body.comentario} ` : '')).trim();

        if (fullMessage) {
            await prisma.tareaHistorial.create({
                data: {
                    tareaId: Number(id),
                    autorId: Number(session.id),
                    tipoAccion: body.estado ? 'CAMBIO_ESTADO' : 'EDICION',
                    mensaje: fullMessage,
                    estadoNuevo: body.estado ? (body.estado as string) : undefined
                }
            });
        }

        return NextResponse.json(updatedTarea);

    } catch (error) {
        console.error("Error updating tarea:", error);
        return NextResponse.json({ error: 'Error actualizando tarea' }, { status: 500 });
    }
}

