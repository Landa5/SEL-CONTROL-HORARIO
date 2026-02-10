import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const proyectos = await prisma.proyecto.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        });
        return NextResponse.json(proyectos);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
    }
}
