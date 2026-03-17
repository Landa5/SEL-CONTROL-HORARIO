import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TareaTipo, TareaPrioridad, TareaEstado } from '@prisma/client';
import {
    buildVisibilityFilter,
    determineVisibilidad,
    determineAreaResponsable,
    createNotificacion,
    notifyParticipantes
} from '@/lib/tareas-engine';

export const dynamic = 'force-dynamic';

import { z } from 'zod';

const createTareaSchema = z.object({
    titulo: z.string().min(1, 'El título es obligatorio'),
    descripcion: z.string().optional(),
    tipo: z.string().optional(),
    prioridad: z.string().optional(),
    activoTipo: z.string().nullable().optional(),
    matricula: z.string().nullable().optional(),
    clienteNombre: z.string().nullable().optional(),
    ubicacionTexto: z.string().nullable().optional(),
    fechaLimite: z.string().nullable().optional(),
    asignadoAId: z.union([z.number(), z.string()]).nullable().optional(),
    parentId: z.union([z.number(), z.string()]).nullable().optional(),
    proyectoId: z.union([z.number(), z.string()]).nullable().optional(),
    privada: z.boolean().optional(),
    descargas: z.union([z.number(), z.string()]).nullable().optional(),
    contactoNombre: z.string().nullable().optional(),
    contactoTelefono: z.string().nullable().optional(),
    // v3.1 - Nuevos campos
    visibilidad: z.string().optional(),
    subtipo: z.string().nullable().optional(),
    areaResponsable: z.string().nullable().optional(),
    reportadoPorCliente: z.boolean().optional(),
    requiereValidacionDireccion: z.boolean().optional(),
    // Extensión Taller
    extensionTaller: z.object({
        tipoAveria: z.string().nullable().optional(),
        kmReporte: z.number().nullable().optional(),
        costeEstimado: z.number().nullable().optional(),
        vehiculoInmovilizado: z.boolean().optional(),
        puedeCircular: z.boolean().optional(),
        requiereGrua: z.boolean().optional(),
        detalleAveria: z.string().nullable().optional(),
        diagnosticoInicial: z.string().nullable().optional(),
        proveedorTaller: z.string().nullable().optional(),
        fechaEntradaTaller: z.string().nullable().optional(),
    }).optional(),
    // Extensión Reclamación
    extensionReclamacion: z.object({
        canalEntrada: z.string().nullable().optional(),
        gravedad: z.string().nullable().optional(),
        clienteNombre: z.string().nullable().optional(),
        clienteTelefono: z.string().nullable().optional(),
        empleadoImplicadoId: z.number().nullable().optional(),
        detalleGravedad: z.string().nullable().optional(),
        requiereRespuestaFormal: z.boolean().optional(),
    }).optional(),
}).refine(data => {
    if (data.activoTipo === 'CAMION' && !data.matricula) return false;
    return true;
}, {
    message: "La matrícula es obligatoria para incidencias de camión",
    path: ["matricula"]
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const jsonBody = await request.json();

        // Validation Logic with Zod
        const parsed = createTareaSchema.safeParse(jsonBody);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0]?.message || 'Error de validación';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const body = parsed.data;

        // Handle Camion Relation if matricula provided
        let camionId: number | undefined = undefined;
        if (body.matricula) {
            const camion = await prisma.camion.findUnique({ where: { matricula: body.matricula } });
            if (camion) camionId = camion.id;
        }

        // Map Frontend Enums to Backend Enums
        let tipoFinal: TareaTipo = TareaTipo.OPERATIVA;
        if (body.tipo === 'AVERIA' || body.tipo === 'MANTENIMIENTO') {
            tipoFinal = TareaTipo.TALLER;
        } else if (body.tipo === 'TAREA_INTERNA') {
            tipoFinal = TareaTipo.ADMINISTRATIVA;
        } else if (Object.values(TareaTipo).includes(body.tipo as TareaTipo)) {
            tipoFinal = body.tipo as TareaTipo;
        }

        let prioridadFinal: TareaPrioridad = TareaPrioridad.MEDIA;
        if (body.prioridad === 'URGENTE') {
            prioridadFinal = TareaPrioridad.ALTA;
        } else if (Object.values(TareaPrioridad).includes(body.prioridad as TareaPrioridad)) {
            prioridadFinal = body.prioridad as TareaPrioridad;
        }

        // v3.1: Determinar visibilidad y área automáticamente
        const asignadoId = body.asignadoAId ? Number(body.asignadoAId) : null;
        const visibilidadFinal = (body.visibilidad as any) || determineVisibilidad(
            tipoFinal, body.privada || false, asignadoId
        );
        const areaFinal = (body.areaResponsable as any) || determineAreaResponsable(tipoFinal);

        const tarea = await prisma.tarea.create({
            data: {
                titulo: body.titulo,
                descripcion: body.descripcion || '',
                tipo: tipoFinal,

                // If deadline or assignee is set, it's not backlog anymore, it's pending/planned
                estado: (body.fechaLimite || body.asignadoAId) ? TareaEstado.PENDIENTE : TareaEstado.BACKLOG,

                prioridad: prioridadFinal,

                activoTipo: body.activoTipo,
                matricula: body.matricula,
                clienteNombre: body.clienteNombre,
                ubicacionTexto: body.ubicacionTexto,

                fechaLimite: body.fechaLimite ? new Date(body.fechaLimite) : null,

                creadoPorId: Number(session.id),
                asignadoAId: asignadoId || undefined,
                parentId: body.parentId ? Number(body.parentId) : undefined,
                proyectoId: body.proyectoId ? Number(body.proyectoId) : undefined,

                privada: body.privada || false,

                camionId: camionId,
                descargas: body.descargas ? Number(body.descargas) : undefined,

                contactoNombre: body.contactoNombre,
                contactoTelefono: body.contactoTelefono,

                // v3.1 campos nuevos
                visibilidad: visibilidadFinal,
                subtipo: body.subtipo,
                areaResponsable: areaFinal,
                reportadoPorCliente: body.reportadoPorCliente || false,
                requiereValidacionDireccion: body.requiereValidacionDireccion || false,
            }
        });

        // v3.1: Crear participante RESPONSABLE (creador)
        await prisma.tareaParticipante.create({
            data: {
                tareaId: tarea.id,
                empleadoId: Number(session.id),
                rolParticipacion: 'RESPONSABLE',
                notificar: true,
            }
        });

        // Si hay asignado diferente al creador, añadir como SEGUIDOR
        if (asignadoId && asignadoId !== Number(session.id)) {
            await prisma.tareaParticipante.create({
                data: {
                    tareaId: tarea.id,
                    empleadoId: asignadoId,
                    rolParticipacion: 'SEGUIDOR',
                    notificar: true,
                }
            });
        }

        // v3.1: Crear extensión de taller si es tipo TALLER
        if (tipoFinal === 'TALLER') {
            const ext = body.extensionTaller || {};
            await prisma.tareaTaller.create({
                data: {
                    tareaId: tarea.id,
                    tipoAveria: ext.tipoAveria as any || undefined,
                    kmReporte: ext.kmReporte ?? undefined,
                    costeEstimado: ext.costeEstimado ?? undefined,
                    vehiculoInmovilizado: ext.vehiculoInmovilizado || false,
                    puedeCircular: ext.puedeCircular !== false,
                    requiereGrua: ext.requiereGrua || false,
                    detalleAveria: ext.detalleAveria,
                    diagnosticoInicial: ext.diagnosticoInicial,
                    proveedorTaller: ext.proveedorTaller,
                    fechaEntradaTaller: ext.fechaEntradaTaller ? new Date(ext.fechaEntradaTaller) : undefined,
                }
            });
        }

        // v3.1: Crear extensión de reclamación si es tipo RECLAMACION
        if (tipoFinal === 'RECLAMACION') {
            const ext = body.extensionReclamacion || {};
            await prisma.tareaReclamacion.create({
                data: {
                    tareaId: tarea.id,
                    canalEntrada: ext.canalEntrada as any || undefined,
                    gravedad: ext.gravedad as any || undefined,
                    clienteNombre: ext.clienteNombre,
                    clienteTelefono: ext.clienteTelefono,
                    empleadoImplicadoId: ext.empleadoImplicadoId ?? undefined,
                    detalleGravedad: ext.detalleGravedad,
                    requiereRespuestaFormal: ext.requiereRespuestaFormal || false,
                }
            });
        }

        // Add initial history entry
        await prisma.tareaHistorial.create({
            data: {
                tareaId: tarea.id,
                autorId: Number(session.id),
                tipoAccion: 'CREACION',
                mensaje: `Tarea creada. Tipo: ${tarea.tipo}, Prioridad: ${tarea.prioridad}, Visibilidad: ${tarea.visibilidad}`
            }
        });

        // v3.1: Notificaciones
        if (tipoFinal === 'TALLER') {
            // Notificar a mecánicos (buscar empleados con rol MECANICO)
            const mecanicos = await prisma.empleado.findMany({
                where: { rol: 'MECANICO', activo: true },
                select: { id: true }
            });
            for (const m of mecanicos) {
                await createNotificacion({
                    usuarioId: m.id,
                    mensaje: `Nueva avería reportada: ${tarea.titulo}`,
                    link: `/admin/tareas?id=${tarea.id}`,
                    tipo: 'AVERIA_REPORTADA',
                    tareaId: tarea.id,
                    actorId: Number(session.id),
                });
            }
        }

        if (asignadoId) {
            await createNotificacion({
                usuarioId: asignadoId,
                mensaje: `Te han asignado la tarea: ${tarea.titulo}`,
                link: `/admin/tareas?id=${tarea.id}`,
                tipo: 'TAREA_ASIGNADA',
                tareaId: tarea.id,
                actorId: Number(session.id),
            });
        }

        return NextResponse.json(tarea);

    } catch (error) {
        console.error('Error creating tarea:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const tipo = searchParams.get('tipo');
        const estado = searchParams.get('estado');
        const prioridad = searchParams.get('prioridad');
        const asignadoAId = searchParams.get('asignadoAId');
        const parentId = searchParams.get('parentId');
        const visibilidad = searchParams.get('visibilidad');
        const auditoria = searchParams.get('auditoria') === 'true';

        let where: any = {};

        // Filtering
        if (tipo) where.tipo = tipo as TareaTipo;
        if (estado) where.estado = estado as TareaEstado;
        if (prioridad) where.prioridad = prioridad as TareaPrioridad;
        if (asignadoAId) where.asignadoAId = Number(asignadoAId);
        if (visibilidad) where.visibilidad = visibilidad;

        // Subtasks filtering
        if (parentId === 'null') where.parentId = null; // Top level tasks
        else if (parentId) where.parentId = Number(parentId);

        // v3.1: Motor de visibilidad
        const visibilityFilter = buildVisibilityFilter(
            { id: Number(session.id), rol: session.rol as string },
            { auditoria }
        );

        // Auditoría: registrar acceso si admin usa modo auditoría
        if (auditoria && session.rol === 'ADMIN') {
            await prisma.auditoria.create({
                data: {
                    usuarioId: Number(session.id),
                    accion: 'ACCESO_AUDITORIA_TAREAS',
                    entidad: 'Tarea',
                    entidadId: 0,
                    detalles: `Admin accedió a vista de auditoría de tareas${visibilidad ? ` (filtro: ${visibilidad})` : ''}`
                }
            });
        }

        // Combinar filtros
        where = {
            AND: [
                where,
                visibilityFilter
            ].filter(f => Object.keys(f).length > 0)
        };

        const tareas = await prisma.tarea.findMany({
            where,
            include: {
                creadoPor: { select: { nombre: true, rol: true } },
                asignadoA: { select: { nombre: true, rol: true } },
                camion: { select: { matricula: true, modelo: true } },
                proyecto: { select: { id: true, nombre: true } },
                subtareas: {
                    select: { id: true, titulo: true, estado: true, asignadoA: { select: { nombre: true } } }
                },
                // v3.1: incluir extensiones y participantes
                extensionTaller: true,
                extensionReclamacion: {
                    select: {
                        id: true, canalEntrada: true, gravedad: true,
                        clienteNombre: true, detalleGravedad: true,
                        requiereRespuestaFormal: true, respuestaEmitida: true,
                        // Ocultar empleadoImplicadoId a no-admin/oficina
                        ...((['ADMIN', 'OFICINA'].includes(session.rol as string))
                            ? { empleadoImplicadoId: true, visibleParaImplicado: true }
                            : {}
                        )
                    }
                },
                participantes: {
                    select: { empleadoId: true, rolParticipacion: true, empleado: { select: { nombre: true } } }
                },
                _count: {
                    select: { subtareas: true, adjuntos: true, historial: true }
                }
            },
            orderBy: [
                { prioridad: 'asc' },
                { fechaLimite: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json(tareas);

    } catch (error) {
        console.error('Error fetching tareas:', error);
        return NextResponse.json({ error: 'Error fetching tareas' }, { status: 500 });
    }
}
