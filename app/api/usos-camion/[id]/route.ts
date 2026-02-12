import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const body = await request.json();
        const { kmInicial, kmFinal, descargasCount, viajesCount, litrosRepostados, fotoKmInicial } = body;

        const dataToUpdate: any = {
            kmInicial: parseInt(kmInicial),
            descargasCount: parseInt(descargasCount) || 0,
            viajesCount: parseInt(viajesCount) || 0,
            litrosRepostados: parseFloat(litrosRepostados) || 0,
            fotoKmInicial
        };

        if (kmFinal !== undefined && kmFinal !== null && kmFinal !== '') {
            dataToUpdate.kmFinal = parseInt(kmFinal);
            dataToUpdate.kmRecorridos = (parseInt(kmFinal) - parseInt(kmInicial));
        } else {
            dataToUpdate.kmFinal = null;
            dataToUpdate.kmRecorridos = 0;
        }

        const updated = await prisma.usoCamion.update({
            where: { id: parseInt(id) },
            data: dataToUpdate
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/usos-camion/[id] error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
