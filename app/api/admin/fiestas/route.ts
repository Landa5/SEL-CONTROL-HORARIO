import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const fiestas = await prisma.fiestaLocal.findMany({
            orderBy: { fecha: 'asc' }
        });
        return NextResponse.json(fiestas);
    } catch (error) {
        return NextResponse.json({ error: 'Error al obtener festivos' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { fecha, nombre, ambito, esAnual } = body;

        if (!fecha || !nombre) {
            return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
        }

        const fiesta = await prisma.fiestaLocal.create({
            data: {
                fecha: new Date(fecha),
                nombre,
                ambito,
                esAnual: esAnual ?? true,
                activa: true
            }
        });

        return NextResponse.json(fiesta);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error al crear festivo' }, { status: 500 });
    }
}
