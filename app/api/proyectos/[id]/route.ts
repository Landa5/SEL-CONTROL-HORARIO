import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ProyectoEstado } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        // Allow updating status to everyone? Or just Admin?
        // "que pueda clasificarlo en pendiente, en curso..." usually implies the person working on it.
        // I will allow everyone to update status for now, or restrict if needed.

        const { id } = await params;
        const body = await request.json();

        const data: any = {};
        if (body.nombre) data.nombre = body.nombre;
        if (body.descripcion !== undefined) data.descripcion = body.descripcion;
        if (body.estado) data.estado = body.estado as ProyectoEstado;
        if (body.activo !== undefined) data.activo = body.activo;

        const proyecto = await prisma.proyecto.update({
            where: { id: Number(id) },
            data
        });

        return NextResponse.json(proyecto);
    } catch (error) {
        console.error('Error updating proyecto:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const userRole = (session as any).rol;
        if (userRole !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id } = await params;

        // Soft delete (set activo = false) or hard delete?
        // Usually soft delete or check dependencies.
        // Let's try soft delete first.
        const proyecto = await prisma.proyecto.update({
            where: { id: Number(id) },
            data: { activo: false }
        });

        return NextResponse.json(proyecto);
    } catch (error) {
        console.error('Error deleting proyecto:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
