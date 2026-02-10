import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(
    request: Request,
    { params }: { params: any }
) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { id } = await params;

        const updated = await prisma.fiestaLocal.update({
            where: { id: parseInt(id) },
            data: {
                fecha: body.fecha ? new Date(body.fecha) : undefined,
                nombre: body.nombre,
                ambito: body.ambito,
                esAnual: body.esAnual,
                activa: body.activa
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: any }
) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { id } = await params;
        await prisma.fiestaLocal.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
    }
}
