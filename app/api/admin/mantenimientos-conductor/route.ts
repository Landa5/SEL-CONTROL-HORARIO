import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Listar todos los mantenimientos (para admin/oficina)
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const camionId = searchParams.get('camionId');
    const empleadoId = searchParams.get('empleadoId');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const registros = await prisma.mantenimientoConductor.findMany({
        where: {
            ...(empleadoId ? { empleadoId: parseInt(empleadoId) } : {}),
            ...(camionId ? { usoCamion: { camionId: parseInt(camionId) } } : {}),
            ...(desde || hasta ? {
                creadoEn: {
                    ...(desde ? { gte: new Date(desde) } : {}),
                    ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {})
                }
            } : {})
        },
        include: {
            empleado: {
                select: { id: true, nombre: true, apellidos: true }
            },
            usoCamion: {
                select: {
                    id: true,
                    camion: { select: { id: true, matricula: true, marca: true, modelo: true } },
                    horaInicio: true
                }
            }
        },
        orderBy: { creadoEn: 'desc' },
        take: 200
    });

    return NextResponse.json(registros);
}
