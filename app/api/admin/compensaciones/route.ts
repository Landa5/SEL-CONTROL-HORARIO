import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || (session.rol !== 'ADMIN' && session.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const compensaciones = await prisma.compensacionFestivo.findMany({
            include: {
                empleado: { select: { nombre: true, rol: true } },
                fiesta: { select: { nombre: true, fecha: true } },
                jornada: { select: { fecha: true, totalHoras: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(compensaciones);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener reporte' }, { status: 500 });
    }
}
