import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/nominas/[id]
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const user: any = await verifyToken(session);

        const nomina = await prisma.nominaMes.findUnique({
            where: { id: parseInt(id) },
            include: { lineas: { orderBy: { orden: 'asc' } }, empleado: true }
        });

        if (!nomina) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

        // Access Control: Admin or Own
        if (user.rol !== 'ADMIN' && user.rol !== 'OFICINA' && nomina.empleadoId !== user.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        return NextResponse.json(nomina);

    } catch (error) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// PATCH /api/nominas/[id]
// Used for closing the payroll or updating simple header fields
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const user: any = await verifyToken(session);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const body = await request.json();
        const { estado } = body;

        const updated = await prisma.nominaMes.update({
            where: { id: parseInt(id) },
            data: {
                estado: estado,
                ...(estado === 'CERRADA' ? { fechaCierre: new Date(), cerradaPorId: parseInt(user.id as string) } : {})
            }
        });

        return NextResponse.json(updated);

    } catch (error) {
        return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
    }
}
