import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ProyectoEstado } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const proyectos = await prisma.proyecto.findMany({
            where: {
                activo: true
            },
            include: {
                _count: {
                    select: { tareas: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate "completed recently" for UI if needed, but we'll return all active ones.
        // The UI will filter "Hecho" (COMPLETADA) > 24h if desired, or we can do it here.
        // User said: "clasificarlo en pendiente, en curso o hecho (ultimas 24h)"
        // If we filter here, we might miss some. Better to return relevant ones.

        return NextResponse.json(proyectos);
    } catch (error) {
        console.error('Error fetching proyectos:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const userRole = (session as any).rol;
        if (userRole !== 'ADMIN' && userRole !== 'OFICINA') {
            return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 });
        }

        const body = await request.json();

        if (!body.nombre) {
            return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 });
        }

        const proyecto = await prisma.proyecto.create({
            data: {
                nombre: body.nombre,
                descripcion: body.descripcion,
                estado: ProyectoEstado.PENDIENTE
            }
        });

        return NextResponse.json(proyecto);
    } catch (error) {
        console.error('Error creating proyecto:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
