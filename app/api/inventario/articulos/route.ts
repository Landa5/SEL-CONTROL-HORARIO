import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const categoriaId = searchParams.get('categoriaId');

        let where: any = {};
        if (categoriaId) {
            where.categoriaId = Number(categoriaId);
        }

        const articulos = await prisma.articuloInventario.findMany({
            where,
            include: {
                categoria: { select: { nombre: true } }
            },
            orderBy: { nombre: 'asc' }
        });

        return NextResponse.json(articulos);
    } catch (error) {
        console.error('Error fetching articulos:', error);
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

        if (!body.nombre || !body.categoriaId) {
            return NextResponse.json({ error: 'El nombre y la categoría son obligatorios' }, { status: 400 });
        }

        const articulo = await prisma.articuloInventario.create({
            data: {
                nombre: body.nombre,
                descripcion: body.descripcion || null,
                codigoBarras: body.codigoBarras || null,
                referencia: body.referencia || null,
                cantidad: Number(body.cantidad) || 0,
                stockMinimo: Number(body.stockMinimo) || 0,
                ubicacion: body.ubicacion || null,
                precioCosto: body.precioCosto ? Number(body.precioCosto) : null,
                categoriaId: Number(body.categoriaId)
            }
        });

        // Add an initial movement if start amount is > 0
        if (articulo.cantidad > 0) {
            await prisma.movimientoInventario.create({
                data: {
                    articuloId: articulo.id,
                    tipo: 'AJUSTE',
                    cantidad: articulo.cantidad,
                    motivo: 'Stock inicial',
                    realizadoPorId: Number(session.id)
                }
            });
        }

        return NextResponse.json(articulo);
    } catch (error: any) {
        console.error('Error creating articulo:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Ya existe un artículo con ese código de barras' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
