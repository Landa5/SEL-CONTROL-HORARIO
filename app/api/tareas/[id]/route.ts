
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
        console.log(`[PATCH Tarea ${id}] Body:`, body);

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

                // AUTOMATIC MAINTENANCE CREATION (Only for TALLER/Truck tasks being Completed)
                if (body.estado === 'COMPLETADA' && (currentTarea.tipo as string) === 'TALLER' && currentTarea.camionId && body.mantenimientoData) {
                    try {
                        const { kmActual, coste } = body.mantenimientoData;
                        await prisma.mantenimientoRealizado.create({
                            data: {
                                fecha: new Date(),
                                camionId: currentTarea.camionId,
                                kmEnEseMomento: kmActual ? Number(kmActual) : (await prisma.camion.findUnique({ where: { id: currentTarea.camionId }, select: { kmActual: true } }))?.kmActual || 0,
                                tipo: 'CORRECTIVO',
                                descripcion: `Resolución Tarea #${currentTarea.id}: ${currentTarea.titulo}`,
                                piezasCambiadas: body.resumenCierre || 'Sin detalles',
                                costo: coste ? parseFloat(coste) : 0,
                                taller: 'Taller Interno', // Default to internal, could be customizable later
                                tareaId: currentTarea.id
                            }
                        });

                        // Update Truck KM if provided and greater than current
                        if (kmActual) {
                            const newKm = Number(kmActual);
                            const truck = await prisma.camion.findUnique({ where: { id: currentTarea.camionId } });
                            if (truck && newKm > truck.kmActual) {
                                await prisma.camion.update({
                                    where: { id: currentTarea.camionId },
                                    data: { kmActual: newKm }
                                });
                            }
                        }

                    } catch (maintError) {
                        console.error("Error creating maintenance record:", maintError);
                        // Don't block task closure, but log error
                    }
                }
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
                // If assigning to someone, and status is BACKLOG, move to PENDING
                if (newAssignee && currentTarea.estado === 'BACKLOG') {
                    updateData.estado = 'PENDIENTE';
                }
                historialMensaje += `Asignación actualizada. `;
            }
        }

        // Project Change (Handle explicit clearing or updating)
        if (body.proyectoId !== undefined) {
            const newProjectId = body.proyectoId ? Number(body.proyectoId) : null;
            if (newProjectId !== currentTarea.proyectoId) {
                updateData.proyectoId = newProjectId;
                historialMensaje += `Proyecto actualizado. `;
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
            // If changing context away from CAMION, clear matricula/camionId
            if (body.activoTipo !== 'CAMION') {
                updateData.matricula = null;
                updateData.camionId = null;
                historialMensaje += `Contexto activo cambiado (Desvinculado de camión). `;
            }
        }

        // Matricula Update (Only if active type is CAMION or implicitly)
        if (body.matricula !== undefined && body.matricula !== currentTarea.matricula) {
            // If manual clear (null) or change
            if (body.matricula === null || body.matricula === '') {
                updateData.matricula = null;
                updateData.camionId = null;
            } else {
                updateData.matricula = body.matricula;
                const camion = await prisma.camion.findUnique({ where: { matricula: body.matricula } });
                updateData.camionId = camion ? camion.id : null;
            }
            historialMensaje += `Matrícula actualizada. `;
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

