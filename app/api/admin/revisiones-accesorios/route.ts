import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Ver todas las revisiones (para admin/oficina)
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const camionId = searchParams.get('camionId');
    const empleadoId = searchParams.get('empleadoId');
    const mes = searchParams.get('mes');

    const revisiones = await prisma.revisionAccesorios.findMany({
        where: {
            ...(camionId ? { camionId: parseInt(camionId) } : {}),
            ...(empleadoId ? { empleadoId: parseInt(empleadoId) } : {}),
            ...(mes ? { mes } : {})
        },
        include: {
            empleado: { select: { id: true, nombre: true, apellidos: true } },
            camion: { select: { id: true, matricula: true, marca: true, modelo: true } }
        },
        orderBy: [{ mes: 'desc' }, { creadoEn: 'desc' }],
        take: 300
    });

    return NextResponse.json(revisiones);
}
