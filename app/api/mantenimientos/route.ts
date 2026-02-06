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
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'MECANICO' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const camionId = searchParams.get('camionId');

        const mantenimientos = await prisma.mantenimientoRealizado.findMany({
            where: camionId ? { camionId: parseInt(camionId) } : {},
            include: {
                camion: { select: { matricula: true, modelo: true } },
                tarea: { select: { titulo: true, id: true } }
            },
            orderBy: { fecha: 'desc' }
        });

        return NextResponse.json(mantenimientos);
    } catch (error) {
        console.error('GET /api/mantenimientos error:', error);
        return NextResponse.json({ error: 'Error al obtener mantenimientos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'MECANICO' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { camionId, fecha, kmEnEseMomento, tipo, descripcion, piezasCambiadas, costo, taller, tareaId } = body;

        const mantenimiento = await prisma.mantenimientoRealizado.create({
            data: {
                camionId: parseInt(camionId),
                fecha: new Date(fecha),
                kmEnEseMomento: parseInt(kmEnEseMomento),
                tipo,
                descripcion,
                piezasCambiadas,
                costo: costo ? parseFloat(costo) : null,
                taller,
                tareaId: tareaId ? parseInt(tareaId) : null
            }
        });

        // Optional: Update truck's current KM if this is the newest record
        const camion = await prisma.camion.findUnique({ where: { id: parseInt(camionId) } });
        if (camion && parseInt(kmEnEseMomento) > camion.kmActual) {
            await prisma.camion.update({
                where: { id: parseInt(camionId) },
                data: { kmActual: parseInt(kmEnEseMomento) }
            });
        }

        return NextResponse.json(mantenimiento);
    } catch (error) {
        console.error('POST /api/mantenimientos error:', error);
        return NextResponse.json({ error: 'Error al crear mantenimiento' }, { status: 500 });
    }
}
