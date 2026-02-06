import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const isAdmin = ['ADMIN', 'OFICINA'].includes(user.rol);
        
        let where: any = {};
        
        if (!isAdmin) {
            const now = new Date();
            where = {
                activo: true,
                fechaInicio: { lte: now },
                fechaFin: { gte: now }
            };
        }

        const modulos = await prisma.moduloFormacion.findMany({
            where,
            include: {
                creadoPor: { select: { nombre: true } },
                _count: { select: { temas: true, preguntas: true } },
                resultados: {
                    where: { empleadoId: parseInt(user.id) }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(modulos);
    } catch (error) {
        console.error('GET /api/formacion/modulos error:', error);
        return NextResponse.json({ error: 'Error al obtener módulos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const body = await request.json();
        const { titulo, descripcion, fechaInicio, fechaFin, duracionEstimada, activo, temas, preguntas } = body;

        // Nested creation of module, topics and questions
        const modulo = await prisma.moduloFormacion.create({
            data: {
                titulo,
                descripcion,
                fechaInicio: new Date(fechaInicio),
                fechaFin: new Date(fechaFin),
                duracionEstimada: parseInt(duracionEstimada) || 0,
                activo: activo ?? true,
                creadoPorId: parseInt(user.id),
                temas: {
                    create: temas?.map((t: any, index: number) => ({
                        titulo: t.titulo,
                        contenido: t.contenido,
                        tipo: t.tipo || 'TEXTO',
                        orden: t.orden ?? index,
                        resourceUrl: t.resourceUrl
                    })) || []
                },
                preguntas: {
                    create: preguntas?.map((p: any) => ({
                        texto: p.texto,
                        opcionA: p.opcionA,
                        opcionB: p.opcionB,
                        opcionC: p.opcionC,
                        correcta: p.correcta,
                        puntos: p.puntos || 10
                    })) || []
                }
            }
        });

        return NextResponse.json(modulo);
    } catch (error) {
        console.error('POST /api/formacion/modulos error:', error);
        return NextResponse.json({ error: 'Error al crear módulo' }, { status: 500 });
    }
}
