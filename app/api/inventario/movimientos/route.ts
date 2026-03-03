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
        const articuloId = searchParams.get('articuloId');
        const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

        let where: any = {};
        if (articuloId) {
            where.articuloId = Number(articuloId);
        }

        const movimientos = await prisma.movimientoInventario.findMany({
            where,
            include: {
                articulo: { select: { nombre: true, referencia: true } },
                realizadoPor: { select: { nombre: true } },
                tarea: { select: { id: true, titulo: true } },
                camion: { select: { matricula: true } }
            },
            orderBy: { fecha: 'desc' },
            take: limit
        });

        return NextResponse.json(movimientos);
    } catch (error) {
        console.error('Error fetching movimientos:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

import { z } from 'zod';

const movimientoSchema = z.object({
    articuloId: z.union([z.number(), z.string()]).transform(Number),
    tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
    cantidad: z.number(),
    permitirNegativo: z.boolean().optional(),
    motivo: z.string().optional(),
    tareaId: z.union([z.number(), z.string()]).nullable().optional(),
    camionId: z.union([z.number(), z.string()]).nullable().optional(),
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const jsonBody = await request.json();

        const parsed = movimientoSchema.safeParse(jsonBody);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Faltan datos obligatorios o son inválidos' }, { status: 400 });
        }

        const body = parsed.data;
        const tipo = body.tipo;
        const cantidad = Math.abs(body.cantidad);

        // Transacción para asegurar la consistencia del inventario
        const result = await prisma.$transaction(async (tx) => {
            const articulo = await tx.articuloInventario.findUnique({
                where: { id: Number(body.articuloId) }
            });

            if (!articulo) {
                throw new Error('Artículo no encontrado');
            }

            let nuevaCantidad = articulo.cantidad;

            if (tipo === 'ENTRADA') {
                nuevaCantidad += cantidad;
            } else if (tipo === 'SALIDA') {
                if (articulo.cantidad < cantidad && !body.permitirNegativo) {
                    throw new Error(`Stock insuficiente. Actual: ${articulo.cantidad}`);
                }
                nuevaCantidad -= cantidad;
            } else if (tipo === 'AJUSTE') {
                // Adjustment sets the absolute quantity
                nuevaCantidad = body.cantidad;
            }

            const mov = await tx.movimientoInventario.create({
                data: {
                    articuloId: articulo.id,
                    tipo: tipo,
                    cantidad: tipo === 'AJUSTE' ? Math.abs(nuevaCantidad - articulo.cantidad) : cantidad,
                    motivo: body.motivo || null,
                    realizadoPorId: Number(session.id),
                    tareaId: body.tareaId ? Number(body.tareaId) : null,
                    camionId: body.camionId ? Number(body.camionId) : null,
                }
            });

            await tx.articuloInventario.update({
                where: { id: articulo.id },
                data: { cantidad: nuevaCantidad }
            });

            return mov;
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error creating movimiento:', error);
        return NextResponse.json({ error: error.message || 'Error al procesar movimiento' }, { status: 400 });
    }
}
