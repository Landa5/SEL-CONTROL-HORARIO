import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseISO, isValid } from 'date-fns';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const truckId = searchParams.get('truckId');
    const type = searchParams.get('type');

    try {
        const where: any = {};
        if (truckId) where.camionId = parseInt(truckId);
        if (type) where.tipo = type;

        const records = await prisma.mantenimientoRealizado.findMany({
            where,
            include: {
                camion: {
                    select: { matricula: true, modelo: true }
                }
            },
            orderBy: { fecha: 'desc' }
        });

        return NextResponse.json(records);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { camionId, tipo, descripcion, costo, kmActual, taller, proximoKm } = body;

        if (!camionId || !tipo) {
            return NextResponse.json({ error: 'Camion ID and Type are required' }, { status: 400 });
        }

        // 1. Create Record
        const record = await prisma.mantenimientoRealizado.create({
            data: {
                camionId: parseInt(camionId),
                tipo,
                descripcion: descripcion || '',
                costo: parseFloat(costo || 0),
                kmEnEseMomento: parseInt(kmActual || 0),
                taller,
                proximoKmPrevisto: proximoKm ? parseInt(proximoKm) : null
            }
        });

        // 2. Update Truck KM if higher
        // Only update if the maintenance record has a higher KM than current
        const truck = await prisma.camion.findUnique({ where: { id: parseInt(camionId) } });
        if (truck && truck.kmActual < parseInt(kmActual)) {
            await prisma.camion.update({
                where: { id: parseInt(camionId) },
                data: { kmActual: parseInt(kmActual) }
            });
        }

        // 3. Mark any "Scheduled" maintenance as completed?
        // We lack a direct link, but we could find open MantenimientoProximo for this truck & type
        await prisma.mantenimientoProximo.updateMany({
            where: {
                camionId: parseInt(camionId),
                tipo: tipo,
                estado: 'PROGRAMADO'
            },
            data: {
                estado: 'COMPLETADO',
                updatedAt: new Date()
            }
        });

        return NextResponse.json(record);

    } catch (error: any) {
        console.error("Error creating maintenance record:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
