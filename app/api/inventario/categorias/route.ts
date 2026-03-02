import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const categorias = await prisma.categoriaInventario.findMany({
            include: {
                _count: {
                    select: { articulos: true }
                }
            },
            orderBy: { nombre: 'asc' }
        });

        return NextResponse.json(categorias);
    } catch (error) {
        console.error('Error fetching categorias:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();

        if (!body.nombre) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
        }

        const categoria = await prisma.categoriaInventario.create({
            data: {
                nombre: body.nombre,
                descripcion: body.descripcion
            }
        });

        return NextResponse.json(categoria);
    } catch (error: any) {
        console.error('Error creating categoria:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe una categoría con este nombre' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
