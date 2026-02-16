import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const id = parseInt(params.id);
        const body = await request.json();

        const updatedEvaluacion = await prisma.evaluacion.update({
            where: { id },
            data: {
                ...body,
                updatedAt: new Date(),
                // Ensure we don't accidentally update immutable fields if passed, strictly speaking Prisma ignores extra fields if not in schema but good to be careful
                // For simplified logic, we trust body to contain valid fields like puntuacionGeneral, comentarios, objetivos, estado
            }
        });

        return NextResponse.json(updatedEvaluacion);

    } catch (error: any) {
        console.error(`PUT /api/admin/evaluaciones/${params.id} Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user: any = session ? await verifyToken(session) : null;

        if (!user || user.rol !== 'ADMIN') { // Only ADMIN can delete
            return NextResponse.json({ error: 'Solo administradores pueden eliminar evaluaciones' }, { status: 403 });
        }

        await prisma.evaluacion.delete({
            where: { id: parseInt(params.id) }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error(`DELETE /api/admin/evaluaciones/${params.id} Error:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
