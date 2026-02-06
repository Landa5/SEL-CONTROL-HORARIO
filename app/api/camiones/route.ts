import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
        try {
            const camion = await prisma.camion.findUnique({
                where: { id: parseInt(id) },
                include: {
                    historialMantenimientos: {
                        include: { tarea: true },
                        orderBy: { fecha: 'desc' }
                    },
                    tareas: {
                        include: { creadoPor: true },
                        orderBy: { createdAt: 'desc' }
                    },
                    usos: {
                        take: 10,
                        orderBy: { horaInicio: 'desc' }
                    }
                }
            });
            return NextResponse.json(camion);
        } catch (error) {
            console.error('Error fetching camion:', error);
            return NextResponse.json({ error: 'Error al obtener camión' }, { status: 500 });
        }
    }

    const camiones = await prisma.camion.findMany({
        where: { activo: true },
        orderBy: { matricula: 'asc' },
    });
    return NextResponse.json(camiones);
}

export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { matricula } = data;

        // Check if truck exists (active or inactive)
        const existing = await prisma.camion.findUnique({
            where: { matricula }
        });

        if (existing) {
            if (!existing.activo) {
                // Reactivate
                const reactivated = await prisma.camion.update({
                    where: { id: existing.id },
                    data: { ...data, activo: true }
                });
                return NextResponse.json(reactivated);
            } else {
                return NextResponse.json({
                    error: `Ya existe un camión activo con la matrícula ${matricula}.`
                }, { status: 400 });
            }
        }

        const camion = await prisma.camion.create({ data });
        return NextResponse.json(camion);
    } catch (error: any) {
        console.error('Error creating truck:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({
                error: `Conflicto de duplicidad: La matrícula o bastidor ya están registrados.`
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error al crear el camión.' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const data = await request.json();
        const { id, ...rest } = data;
        const camion = await prisma.camion.update({
            where: { id: parseInt(id) },
            data: rest,
        });
        return NextResponse.json(camion);
    } catch (error: any) {
        console.error('Error updating truck:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({
                error: `La matrícula o bastidor ya están en uso por otro camión.`
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error actualizando camión' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

        await prisma.camion.update({
            where: { id: parseInt(id) },
            data: { activo: false },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error eliminando camión' }, { status: 500 });
    }
}
