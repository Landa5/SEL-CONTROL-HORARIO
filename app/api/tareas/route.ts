import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { TareaTipo, TareaPrioridad, TareaEstado } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();

        // Validation Logic
        if (!body.titulo) {
            return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });
        }

        // Camion specific validation for OPERATIVA/AVERIA
        if (body.activoTipo === 'CAMION') {
            if (!body.matricula) {
                return NextResponse.json({ error: 'La matrícula es obligatoria para incidencias de camión' }, { status: 400 });
            }
        }

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
                asignadoAId: body.asignadoAId ? Number(body.asignadoAId) : undefined,
                parentId: body.parentId ? Number(body.parentId) : undefined,
                proyectoId: body.proyectoId ? Number(body.proyectoId) : undefined,

                privada: body.privada || false, // Handle private tasks

                camionId: camionId,
                descargas: body.descargas ? Number(body.descargas) : undefined,

                contactoNombre: body.contactoNombre,
                contactoTelefono: body.contactoTelefono,
            }
        });

        // Add initial history entry
        await prisma.tareaHistorial.create({
            data: {
                tareaId: tarea.id,
                autorId: Number(session.id),
                tipoAccion: 'CREACION',
                mensaje: `Tarea creada. Tipo: ${tarea.tipo}, Prioridad: ${tarea.prioridad}${tarea.privada ? ', Privada' : ''}`
            }
        });

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

        let where: any = {};

        // Filtering
        if (tipo) where.tipo = tipo as TareaTipo;
        if (estado) where.estado = estado as TareaEstado;
        if (prioridad) where.prioridad = prioridad as TareaPrioridad;
        if (asignadoAId) where.asignadoAId = Number(asignadoAId);

        // Subtasks filtering
        if (parentId === 'null') where.parentId = null; // Top level tasks
        else if (parentId) where.parentId = Number(parentId);

        // VISIBILITY RULES
        const isGlobalAdmin = session.rol === 'ADMIN';

        if (!isGlobalAdmin) {
            // BASIC RULE: Non-admins cannot see PRIVATE tasks unless they are the creator or assignee
            // Since we want strict privacy for Admins, we might even exclude "asignadoAId" if it was assigned by mistake,
            // but standard logic is: if assigned to you, you see it.

            const privacyFilter = {
                OR: [
                    { privada: false },
                    { creadoPorId: Number(session.id) },
                    { asignadoAId: Number(session.id) }
                ]
            };

            const isStaff = ['MECANICO', 'OFICINA'].includes(session.rol as string);

            if (isStaff) {
                // Staff: Can see their own, assigned to them, OR unassigned (pool) BUT NOT RECLAMACION
                // They CANNOT see tasks assigned to others.
                where.AND = [
                    privacyFilter,
                    {
                        OR: [
                            { creadoPorId: Number(session.id) },
                            { asignadoAId: Number(session.id) },
                            {
                                AND: [
                                    { asignadoAId: null },
                                    { tipo: { not: 'RECLAMACION' } }
                                ]
                            },
                            { tipo: 'TALLER' } // Mechanics and Office should see ALL workshop tasks (breakdowns)
                        ]
                    }
                ];
            } else {
                // Regular Employee: Can only see their own or assigned to them
                where.AND = [
                    privacyFilter,
                    {
                        OR: [
                            { creadoPorId: Number(session.id) },
                            { asignadoAId: Number(session.id) }
                        ]
                    }
                ];
            }
        }

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
                _count: {
                    select: { subtareas: true, adjuntos: true, historial: true }
                }
            },
            orderBy: [
                { prioridad: 'asc' }, // ALTA (0) -> MEDIA (?) wait, usually Enum order matters. 
                // Default Enum order: ALTA, MEDIA, BAJA. So 'asc' is correct if ALTA is first.
                { fechaLimite: 'asc' }, // Nulls last? Prisma sorts nulls based on DB. 
                { createdAt: 'desc' }
            ]
        });

        return NextResponse.json(tareas);

    } catch (error) {
        console.error('Error fetching tareas:', error);
        return NextResponse.json({ error: 'Error fetching tareas' }, { status: 500 });
    }
}
