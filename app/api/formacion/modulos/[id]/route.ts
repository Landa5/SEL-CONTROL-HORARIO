import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const { id } = await params;
        const modulo = await prisma.moduloFormacion.findUnique({
            where: { id: parseInt(id) },
            include: {
                temas: { orderBy: { orden: 'asc' } },
                preguntas: true,
                resultados: {
                    where: { empleadoId: parseInt(user.id) }
                }
            }
        });

        if (!modulo) return NextResponse.json({ error: 'Módulo no encontrado' }, { status: 404 });

        // Basic date and status check for employees
        const isAdmin = ['ADMIN', 'OFICINA'].includes(user.rol);
        if (!isAdmin) {
            const now = new Date();
            if (!modulo.activo || modulo.fechaInicio > now || modulo.fechaFin < now) {
                return NextResponse.json({ error: 'Módulo no disponible o expirado' }, { status: 403 });
            }
        }

        return NextResponse.json(modulo);
    } catch (error) {
        console.error('GET /api/formacion/modulos/[id] error:', error);
        return NextResponse.json({ error: 'Error al obtener módulo' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { titulo, descripcion, fechaInicio, fechaFin, duracionEstimada, activo, temas, preguntas } = body;

        // RULE: Administrators cannot edit questions after an employee has completed the evaluation
        const alreadyCompleted = await prisma.resultadoFormacion.count({
            where: { moduloId: parseInt(id) }
        });

        if (alreadyCompleted > 0 && preguntas) {
            // we could allow minor edits or just block question structural changes.
            // for now, strict block as per requirements.
            return NextResponse.json({ error: 'No se pueden editar las preguntas porque ya hay empleados que han completado el módulo.' }, { status: 400 });
        }

        // Use transaction for consistency
        const modulo = await prisma.$transaction(async (tx) => {
            // Update main info
            const updated = await tx.moduloFormacion.update({
                where: { id: parseInt(id) },
                data: {
                    titulo,
                    descripcion,
                    fechaInicio: fechaInicio ? new Date(fechaInicio) : undefined,
                    fechaFin: fechaFin ? new Date(fechaFin) : undefined,
                    duracionEstimada: duracionEstimada !== undefined ? parseInt(duracionEstimada) : undefined,
                    activo
                }
            });

            // Update topics (complex due to reordering/editing)
            // Simplest approach for POC: delete and recreate if provided
            if (temas) {
                await tx.temaFormacion.deleteMany({ where: { moduloId: parseInt(id) } });
                await tx.temaFormacion.createMany({
                    data: temas.map((t: any, idx: number) => ({
                        moduloId: parseInt(id),
                        titulo: t.titulo,
                        contenido: t.contenido,
                        tipo: t.tipo || 'TEXTO',
                        orden: t.orden ?? idx,
                        resourceUrl: t.resourceUrl
                    }))
                });
            }

            // Update questions (if allowed)
            if (preguntas && alreadyCompleted === 0) {
                await tx.preguntaFormacion.deleteMany({ where: { moduloId: parseInt(id) } });
                await tx.preguntaFormacion.createMany({
                    data: preguntas.map((p: any) => ({
                        moduloId: parseInt(id),
                        texto: p.texto,
                        opcionA: p.opcionA,
                        opcionB: p.opcionB,
                        opcionC: p.opcionC,
                        correcta: p.correcta,
                        puntos: p.puntos || 10
                    }))
                });
            }

            return updated;
        });

        return NextResponse.json(modulo);
    } catch (error) {
        console.error('PATCH /api/formacion/modulos/[id] error:', error);
        return NextResponse.json({ error: 'Error al actualizar módulo' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const { id } = await params;
        await prisma.moduloFormacion.delete({ where: { id: parseInt(id) } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/formacion/modulos/[id] error:', error);
        return NextResponse.json({ error: 'Error al eliminar módulo' }, { status: 500 });
    }
}
