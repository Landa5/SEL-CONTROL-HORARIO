
import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TareaEstado, TareaPrioridad, TareaTipo } from '@prisma/client';
import {
    validateCierreTaller,
    checkPermission,
    createNotificacion,
    notifyParticipantes,
} from '@/lib/tareas-engine';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const tarea = await prisma.tarea.findUnique({
            where: { id: Number(id) },
            include: {
                creadoPor: { select: { id: true, nombre: true, rol: true } },
                asignadoA: { select: { id: true, nombre: true, rol: true } },
                camion: { select: { matricula: true, modelo: true } },
                historial: {
                    include: { autor: { select: { nombre: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                adjuntos: true,
                subtareas: {
                    include: { asignadoA: { select: { nombre: true } } }
                },
                // v3.1: incluir extensiones y participantes
                extensionTaller: true,
                extensionReclamacion: true,
                participantes: {
                    include: { empleado: { select: { id: true, nombre: true, rol: true } } }
                },
            }
        });

        if (!tarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

        // v3.1: Ocultar datos sensibles de reclamación según rol
        if (tarea.extensionReclamacion && !['ADMIN', 'OFICINA'].includes(session.rol as string)) {
            const rec = tarea.extensionReclamacion as any;
            if (!rec.visibleParaImplicado || rec.empleadoImplicadoId !== Number(session.id)) {
                rec.empleadoImplicadoId = null;
                rec.accionCorrectiva = null;
            }
        }

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
        console.log(`[PATCH Tarea ${id}] Body:`, JSON.stringify(body).substring(0, 500));

        // Fetch current state with extensions
        const currentTarea = await prisma.tarea.findUnique({
            where: { id: Number(id) },
            include: {
                extensionTaller: true,
                extensionReclamacion: true,
                participantes: { select: { empleadoId: true } },
            }
        });
        if (!currentTarea) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

        const updateData: any = {};
        let historialMensaje = '';
        let historialTipo = 'EDICION';

        // ═══════════ REAPERTURA (solo ADMIN) ═══════════
        if (body.estado && body.estado !== 'COMPLETADA' && body.estado !== 'CANCELADA' &&
            (currentTarea.estado === 'COMPLETADA' || currentTarea.estado === 'CANCELADA')) {

            if (session.rol !== 'ADMIN') {
                return NextResponse.json(
                    { error: 'Solo ADMIN puede reabrir tareas completadas/canceladas' },
                    { status: 403 }
                );
            }

            updateData.estado = body.estado as TareaEstado;
            updateData.fechaCierre = null;
            historialMensaje += `REAPERTURA: Estado cambiado de ${currentTarea.estado} a ${body.estado}. `;
            historialTipo = 'REAPERTURA';

            // Registrar en historial como REAPERTURA
            await prisma.tareaHistorial.create({
                data: {
                    tareaId: Number(id),
                    autorId: Number(session.id),
                    tipoAccion: 'REAPERTURA',
                    mensaje: `Tarea reabierta por admin. Estado anterior: ${currentTarea.estado}`,
                    estadoNuevo: body.estado
                }
            });

            // Notificar a participantes
            await notifyParticipantes({
                tareaId: Number(id),
                actorId: Number(session.id),
                mensaje: `Tarea reabierta: ${currentTarea.titulo}`,
                link: `/admin/tareas?id=${id}`,
                tipo: 'CAMBIO_ESTADO',
            });

            const updatedTarea = await prisma.tarea.update({
                where: { id: Number(id) },
                data: updateData
            });
            return NextResponse.json(updatedTarea);
        }

        // ═══════════ CIERRE TALLER ═══════════
        if (body.estado && (body.estado === 'COMPLETADA') &&
            currentTarea.estado !== 'COMPLETADA' &&
            (currentTarea.tipo as string) === 'TALLER') {

            // Verificar permisos de cierre
            if (!checkPermission(
                { id: Number(session.id), rol: session.rol as string },
                currentTarea,
                'cerrar',
                currentTarea.participantes
            )) {
                return NextResponse.json(
                    { error: 'No tienes permisos para cerrar esta tarea' },
                    { status: 403 }
                );
            }

            // v3.1: Validar campos obligatorios de cierre
            const resumenCierre = body.resumenCierre || currentTarea.resumenCierre;
            const validation = validateCierreTaller(
                currentTarea.extensionTaller,
                resumenCierre,
                body.extensionTaller
            );

            if (!validation.valid) {
                return NextResponse.json(
                    { error: 'Campos obligatorios para cerrar TALLER', detalles: validation.errors },
                    { status: 400 }
                );
            }

            // Actualizar extensión taller con datos de cierre
            if (body.extensionTaller) {
                const extUpdate: any = {};
                if (body.extensionTaller.diagnosticoFinal !== undefined)
                    extUpdate.diagnosticoFinal = body.extensionTaller.diagnosticoFinal;
                if (body.extensionTaller.tipoAveria !== undefined)
                    extUpdate.tipoAveria = body.extensionTaller.tipoAveria;
                if (body.extensionTaller.costeFinal !== undefined)
                    extUpdate.costeFinal = body.extensionTaller.costeFinal;
                if (body.extensionTaller.kmReporte !== undefined)
                    extUpdate.kmReporte = body.extensionTaller.kmReporte;
                if (body.extensionTaller.proveedorTaller !== undefined)
                    extUpdate.proveedorTaller = body.extensionTaller.proveedorTaller;

                // Auto-rellenos
                if (!currentTarea.extensionTaller?.fechaSalidaTaller && !body.extensionTaller.fechaSalidaTaller) {
                    extUpdate.fechaSalidaTaller = new Date();
                } else if (body.extensionTaller.fechaSalidaTaller) {
                    extUpdate.fechaSalidaTaller = new Date(body.extensionTaller.fechaSalidaTaller);
                }

                if (!currentTarea.extensionTaller?.proveedorTaller && !body.extensionTaller.proveedorTaller) {
                    extUpdate.proveedorTaller = 'Interno';
                }

                if (Object.keys(extUpdate).length > 0 && currentTarea.extensionTaller) {
                    await prisma.tareaTaller.update({
                        where: { tareaId: Number(id) },
                        data: extUpdate
                    });
                }
            }

            // Cerrar tarea
            updateData.estado = 'COMPLETADA';
            updateData.fechaCierre = new Date();
            updateData.resumenCierre = resumenCierre;

            // Determinar si es primera intervención o reintervención
            const wasReopened = await prisma.tareaHistorial.findFirst({
                where: { tareaId: Number(id), tipoAccion: 'REAPERTURA' }
            });
            const tipoMantenimiento = wasReopened ? 'REINTERVENCION' : 'CORRECTIVO';

            // Crear MantenimientoRealizado si hay camión
            if (currentTarea.camionId) {
                try {
                    const ext = currentTarea.extensionTaller;
                    const costeFinalVal = body.extensionTaller?.costeFinal ?? ext?.costeFinal ?? 0;
                    const kmVal = body.extensionTaller?.kmReporte ?? ext?.kmReporte;
                    const diagnostico = body.extensionTaller?.diagnosticoFinal ?? ext?.diagnosticoFinal ?? '';

                    const truck = await prisma.camion.findUnique({
                        where: { id: currentTarea.camionId },
                        select: { kmActual: true }
                    });

                    const kmFinal = kmVal || truck?.kmActual || 0;

                    const numIntervencion = wasReopened
                        ? await prisma.mantenimientoRealizado.count({ where: { tareaId: Number(id) } }) + 1
                        : 1;

                    const descripcionMant = wasReopened
                        ? `Reintervención Tarea #${id} (${numIntervencion}ª intervención): ${diagnostico}. ${resumenCierre || ''}`
                        : `Resolución Tarea #${id}: ${diagnostico}. ${resumenCierre || ''}`;

                    await prisma.mantenimientoRealizado.create({
                        data: {
                            fecha: new Date(),
                            camionId: currentTarea.camionId,
                            kmEnEseMomento: kmFinal,
                            tipo: tipoMantenimiento,
                            descripcion: descripcionMant.trim(),
                            piezasCambiadas: body.extensionTaller?.piezasCambiadas || null,
                            costo: parseFloat(String(costeFinalVal)) || 0,
                            taller: body.extensionTaller?.proveedorTaller || ext?.proveedorTaller || 'Interno',
                            tareaId: Number(id),
                        }
                    });

                    // Actualizar km del camión si es mayor
                    if (kmVal && truck && kmVal > truck.kmActual) {
                        await prisma.camion.update({
                            where: { id: currentTarea.camionId },
                            data: { kmActual: kmVal }
                        });
                    }

                    historialMensaje += `MantenimientoRealizado creado (tipo: ${tipoMantenimiento}). `;
                } catch (maintError) {
                    console.error("Error creating maintenance record:", maintError);
                    historialMensaje += `Error al crear MantenimientoRealizado. `;
                }
            } else {
                console.warn(`[CIERRE TALLER] Tarea ${id} sin camionId, no se genera MantenimientoRealizado`);
            }

            historialMensaje += `Tarea completada. `;
            historialTipo = 'CIERRE';

            // Notificar participantes
            await notifyParticipantes({
                tareaId: Number(id),
                actorId: Number(session.id),
                mensaje: `Tarea cerrada: ${currentTarea.titulo}`,
                link: `/admin/tareas?id=${id}`,
                tipo: 'CAMBIO_ESTADO',
            });

        } else {
            // ═══════════ CAMBIOS NORMALES ═══════════

            // Status Change (non-TALLER closure or non-closure)
            if (body.estado && body.estado !== currentTarea.estado) {
                updateData.estado = body.estado as TareaEstado;
                historialMensaje += `Estado cambiado a ${body.estado}. `;
                historialTipo = 'CAMBIO_ESTADO';

                // Handle non-TALLER closing dates
                if (body.estado === 'COMPLETADA' || body.estado === 'CANCELADA') {
                    updateData.fechaCierre = new Date();
                    if (body.resumenCierre) updateData.resumenCierre = body.resumenCierre;

                    // Legacy: MantenimientoRealizado for non-TALLER types (kept for compatibility)
                    if (body.estado === 'COMPLETADA' && (currentTarea.tipo as string) === 'TALLER' &&
                        currentTarea.camionId && body.mantenimientoData) {
                        // This path should not be reached anymore (handled above),
                        // but kept for backward compatibility with old frontend
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
                                    taller: 'Taller Interno',
                                    tareaId: currentTarea.id
                                }
                            });
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
                            console.error("Error creating maintenance record (legacy):", maintError);
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

                // Notificar cambio de estado
                await notifyParticipantes({
                    tareaId: Number(id),
                    actorId: Number(session.id),
                    mensaje: `Estado cambiado a ${body.estado}: ${currentTarea.titulo}`,
                    link: `/admin/tareas?id=${id}`,
                    tipo: 'CAMBIO_ESTADO',
                });
            }

            // Priority Change
            if (body.prioridad && body.prioridad !== currentTarea.prioridad) {
                let prioridadFinal = body.prioridad;
                if (body.prioridad === 'URGENTE') {
                    prioridadFinal = TareaPrioridad.ALTA;
                }
                updateData.prioridad = prioridadFinal as TareaPrioridad;
                historialMensaje += `Prioridad cambiada a ${prioridadFinal}. `;
            }

            // Assignment Change
            if (body.asignadoAId !== undefined) {
                const newAssignee = body.asignadoAId ? Number(body.asignadoAId) : null;
                if (newAssignee !== currentTarea.asignadoAId) {
                    updateData.asignadoAId = newAssignee;
                    if (newAssignee && currentTarea.estado === 'BACKLOG') {
                        updateData.estado = 'PENDIENTE';
                    }
                    historialMensaje += `Asignación actualizada. `;

                    // v3.1: Añadir como participante SEGUIDOR
                    if (newAssignee) {
                        await prisma.tareaParticipante.upsert({
                            where: { tareaId_empleadoId: { tareaId: Number(id), empleadoId: newAssignee } },
                            update: {},
                            create: {
                                tareaId: Number(id),
                                empleadoId: newAssignee,
                                rolParticipacion: 'SEGUIDOR',
                                notificar: true,
                            }
                        });

                        await createNotificacion({
                            usuarioId: newAssignee,
                            mensaje: `Te han asignado la tarea: ${currentTarea.titulo}`,
                            link: `/admin/tareas?id=${id}`,
                            tipo: 'TAREA_ASIGNADA',
                            tareaId: Number(id),
                            actorId: Number(session.id),
                        });
                    }
                }
            }

            // Project Change
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
                let tipoFinal = body.tipo;
                if (body.tipo === 'AVERIA' || body.tipo === 'MANTENIMIENTO') {
                    tipoFinal = TareaTipo.TALLER as any;
                } else if (body.tipo === 'TAREA_INTERNA') {
                    tipoFinal = TareaTipo.ADMINISTRATIVA;
                }
                updateData.tipo = tipoFinal as TareaTipo;
                historialMensaje += `Tipo cambiado a ${tipoFinal}. `;
            }

            // Private Status Change & Visibility sync
            if (body.privada !== undefined && body.privada !== currentTarea.privada) {
                updateData.privada = body.privada;
                historialMensaje += body.privada ? 'Marcada como PRIVADA. ' : 'Marcada como PÚBLICA. ';
            }

            // v3.1: Visibilidad explícita
            if (body.visibilidad && body.visibilidad !== currentTarea.visibilidad) {
                updateData.visibilidad = body.visibilidad;
                historialMensaje += `Visibilidad cambiada a ${body.visibilidad}. `;
            }

            // v3.1: Área responsable
            if (body.areaResponsable !== undefined && body.areaResponsable !== currentTarea.areaResponsable) {
                updateData.areaResponsable = body.areaResponsable;
            }

            // Context Fields
            if (body.activoTipo && body.activoTipo !== currentTarea.activoTipo) {
                updateData.activoTipo = body.activoTipo;
                if (body.activoTipo !== 'CAMION') {
                    updateData.matricula = null;
                    updateData.camionId = null;
                    historialMensaje += `Contexto activo cambiado (Desvinculado de camión). `;
                }
            }

            // Matricula Update
            if (body.matricula !== undefined && body.matricula !== currentTarea.matricula) {
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

            // v3.1: Actualizar extensión taller (edición parcial)
            if (body.extensionTaller && currentTarea.extensionTaller) {
                const extUpdate: any = {};
                const ext = body.extensionTaller;
                if (ext.tipoAveria !== undefined) extUpdate.tipoAveria = ext.tipoAveria;
                if (ext.kmReporte !== undefined) extUpdate.kmReporte = ext.kmReporte;
                if (ext.costeEstimado !== undefined) extUpdate.costeEstimado = ext.costeEstimado;
                if (ext.costeFinal !== undefined) extUpdate.costeFinal = ext.costeFinal;
                if (ext.vehiculoInmovilizado !== undefined) extUpdate.vehiculoInmovilizado = ext.vehiculoInmovilizado;
                if (ext.puedeCircular !== undefined) extUpdate.puedeCircular = ext.puedeCircular;
                if (ext.requiereGrua !== undefined) extUpdate.requiereGrua = ext.requiereGrua;
                if (ext.detalleAveria !== undefined) extUpdate.detalleAveria = ext.detalleAveria;
                if (ext.diagnosticoInicial !== undefined) extUpdate.diagnosticoInicial = ext.diagnosticoInicial;
                if (ext.diagnosticoFinal !== undefined) extUpdate.diagnosticoFinal = ext.diagnosticoFinal;
                if (ext.proveedorTaller !== undefined) extUpdate.proveedorTaller = ext.proveedorTaller;
                if (ext.piezaPendiente !== undefined) extUpdate.piezaPendiente = ext.piezaPendiente;
                if (ext.tiempoInmovilizacionHoras !== undefined) extUpdate.tiempoInmovilizacionHoras = ext.tiempoInmovilizacionHoras;
                if (ext.fechaEntradaTaller !== undefined) extUpdate.fechaEntradaTaller = ext.fechaEntradaTaller ? new Date(ext.fechaEntradaTaller) : null;
                if (ext.fechaSalidaTaller !== undefined) extUpdate.fechaSalidaTaller = ext.fechaSalidaTaller ? new Date(ext.fechaSalidaTaller) : null;

                if (Object.keys(extUpdate).length > 0) {
                    await prisma.tareaTaller.update({
                        where: { tareaId: Number(id) },
                        data: extUpdate
                    });
                    historialMensaje += 'Datos técnicos de taller actualizados. ';
                }
            }

            // v3.1: Actualizar extensión reclamación (edición parcial)
            if (body.extensionReclamacion && currentTarea.extensionReclamacion) {
                const extUpdate: any = {};
                const ext = body.extensionReclamacion;
                if (ext.canalEntrada !== undefined) extUpdate.canalEntrada = ext.canalEntrada;
                if (ext.gravedad !== undefined) extUpdate.gravedad = ext.gravedad;
                if (ext.clienteNombre !== undefined) extUpdate.clienteNombre = ext.clienteNombre;
                if (ext.clienteTelefono !== undefined) extUpdate.clienteTelefono = ext.clienteTelefono;
                if (ext.empleadoImplicadoId !== undefined) extUpdate.empleadoImplicadoId = ext.empleadoImplicadoId;
                if (ext.visibleParaImplicado !== undefined) extUpdate.visibleParaImplicado = ext.visibleParaImplicado;
                if (ext.detalleGravedad !== undefined) extUpdate.detalleGravedad = ext.detalleGravedad;
                if (ext.requiereRespuestaFormal !== undefined) extUpdate.requiereRespuestaFormal = ext.requiereRespuestaFormal;
                if (ext.respuestaEmitida !== undefined) extUpdate.respuestaEmitida = ext.respuestaEmitida;
                if (ext.fechaRespuesta !== undefined) extUpdate.fechaRespuesta = ext.fechaRespuesta ? new Date(ext.fechaRespuesta) : null;
                if (ext.accionCorrectiva !== undefined) extUpdate.accionCorrectiva = ext.accionCorrectiva;

                if (Object.keys(extUpdate).length > 0) {
                    await prisma.tareaReclamacion.update({
                        where: { tareaId: Number(id) },
                        data: extUpdate
                    });
                    historialMensaje += 'Datos de reclamación actualizados. ';
                }
            }
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
                    tipoAccion: historialTipo,
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
