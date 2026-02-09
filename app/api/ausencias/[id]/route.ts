import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || (session.rol !== 'ADMIN' && session.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { estado } = body;
        const { id } = await params;

        const ausencia = await prisma.ausencia.findUnique({
            where: { id: parseInt(id) },
            include: { empleado: true }
        });

        if (!ausencia) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

        // Logic for vacation balance subtraction removed. 
        // We now calculate balance dynamically in stats API based on approved absences.

        const updated = await prisma.ausencia.update({
            where: { id: parseInt(id) },
            data: {
                estado,
                fechaResolucion: new Date(),
                aprobadoPorId: Number(session.id)
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }
}
