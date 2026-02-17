import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        // Fetch evaluations for the valid user
        const evaluations = await prisma.evaluacion.findMany({
            where: {
                empleadoId: parseInt(user.id),
                estado: 'COMPLETADA' // Only show completed evaluations to employees
            },
            orderBy: {
                fecha: 'desc'
            }
            // Include details if needed, but standard select is usually fine
        });

        return NextResponse.json(evaluations);
    } catch (error) {
        console.error('GET /api/empleado/evaluaciones error:', error);
        return NextResponse.json({ error: 'Error al obtener evaluaciones' }, { status: 500 });
    }
}
