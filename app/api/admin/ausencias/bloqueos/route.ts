import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const bloqueos = await prisma.periodoBloqueado.findMany({
            orderBy: { fechaInicio: 'desc' }
        });

        return NextResponse.json(bloqueos);
    } catch (error) {
        console.error('Error fetching blocks:', error);
        return NextResponse.json({ error: 'Error al obtener bloqueos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { fechaInicio, fechaFin, motivo } = body;

        if (!fechaInicio || !fechaFin || !motivo) {
            return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
        }

        const bloqueo = await prisma.periodoBloqueado.create({
            data: {
                fechaInicio: new Date(fechaInicio),
                fechaFin: new Date(fechaFin),
                motivo,
                activo: true
            }
        });

        return NextResponse.json(bloqueo);
    } catch (error) {
        console.error('Error creating block:', error);
        return NextResponse.json({ error: 'Error al crear bloqueo' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        await prisma.periodoBloqueado.delete({
            where: { id: Number(id) }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting block:', error);
        return NextResponse.json({ error: 'Error al eliminar bloqueo' }, { status: 500 });
    }
}
