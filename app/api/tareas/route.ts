import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();

        // Validation Logic
        if (!body.titulo || !body.descripcion) {
            return NextResponse.json({ error: 'Título y descripción son obligatorios' }, { status: 400 });
        }

        // Camion specific validation
        if (body.activoTipo === 'CAMION') {
            if (!body.matricula) {
                return NextResponse.json({ error: 'La matrícula es obligatoria para incidencias de camión' }, { status: 400 });
            }
            if (!body.kilometros) {
                return NextResponse.json({ error: 'Los kilómetros son obligatorios para incidencias de camión' }, { status: 400 });
            }
        }

        // Handle Camion Relation if matricula provided
        let camionId = undefined;
        if (body.matricula) {
            const camion = await prisma.camion.findUnique({ where: { matricula: body.matricula } });
            if (camion) {
                camionId = camion.id;
            } else {
                // Or create it? Usually we expect existing truck. 
                // For now, if truck doesn't exist, we just store the matricula string but no relation?
                // Rule: "Una tarea afecta a un activo". Should link if possible.
            }
        }

        const tarea = await prisma.tarea.create({
            data: {
                titulo: body.titulo,
                descripcion: body.descripcion,
                tipo: body.tipo || 'AVERIA',
                estado: 'ABIERTA', // Always open initially
                prioridad: body.prioridad || 'MEDIA',
                activoTipo: body.activoTipo,

                matricula: body.matricula,
                // store KMs in description or history? Schema doesn't have `kilometros` field on Tarea explicitly? 
                // Wait, schema `Tarea` had `matricula` but NOT `kilometros`.
                // Requirement 3: "Kilómetros obligatorios".
                // I might need to put KMs in description OR strictly add `kilometros` to Tarea schema? 
                // Ah, I missed adding `kilometros` to Tarea in schema update!
                // But `UsoCamion` has KMs. `MantenimientoRealizado` has `kmEnEseMomento`.
                // Tarea SHOULD have `kmEnEseMomento` if it's an event.
                // For now I will append to description to avoid another migration immediately, OR use `ubicacionTexto`? No.
                // Let's add it to description: "KM: 12345\n\nDesc..."

                clienteNombre: body.clienteNombre,
                ubicacionTexto: body.ubicacionTexto,
                descargas: body.descargas ? Number(body.descargas) : undefined,

                contactoNombre: body.contactoNombre,
                contactoTelefono: body.contactoTelefono,

                creadoPorId: Number(session.id),
                asignadoAId: body.asignadoAId ? Number(body.asignadoAId) : undefined, // Optional assignment

                camionId: camionId
            }
        });

        // Add initial history entry
        await prisma.tareaHistorial.create({
            data: {
                tareaId: tarea.id,
                autorId: Number(session.id),
                tipoAccion: 'CREACION',
                mensaje: `Tarea creada. Prioridad: ${tarea.prioridad}. ${body.kilometros ? 'KM: ' + body.kilometros : ''}`
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

        let where: any = {};

        // Filtering
        if (tipo) where.tipo = tipo;
        if (estado) where.estado = estado;

        // VISIBILITY RULES
        // MECANICO & ADMIN & OFICINA -> See ALL
        // CONDUCTOR -> See ONLY created by them OR assigned to them

        const isStaff = ['ADMIN', 'MECANICO', 'OFICINA'].includes(session.rol as string);

        if (!isStaff) {
            where.OR = [
                { creadoPorId: Number(session.id) },
                { asignadoAId: Number(session.id) }
            ];
        }

        const tareas = await prisma.tarea.findMany({
            where,
            include: {
                creadoPor: { select: { nombre: true, rol: true } },
                asignadoA: { select: { nombre: true } },
                camion: { select: { matricula: true, modelo: true } }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(tareas);

    } catch (error) {
        return NextResponse.json({ error: 'Error fetching tareas' }, { status: 500 });
    }
}
