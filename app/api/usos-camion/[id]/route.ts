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

        // Fetch existing record to merge data if not all fields are provided in the update
        const existingUso = await prisma.usoCamion.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingUso) {
            return NextResponse.json({ error: 'Uso no encontrado' }, { status: 404 });
        }

        const dataToUpdate: any = {
            kmInicial: body.kmInicial !== undefined ? parseInt(body.kmInicial) : existingUso.kmInicial,
            descargasCount: body.descargasCount !== undefined ? parseInt(body.descargasCount) : existingUso.descargasCount,
            viajesCount: body.viajesCount !== undefined ? parseInt(body.viajesCount) : existingUso.viajesCount,
            litrosRepostados: body.litrosRepostados !== undefined ? parseFloat(body.litrosRepostados) : existingUso.litrosRepostados,
            fotoKmInicial: body.fotoKmInicial !== undefined ? body.fotoKmInicial : existingUso.fotoKmInicial
        };

        // Handle KM Final and Recorridos calculation
        let newKmFinal = body.kmFinal !== undefined ? (body.kmFinal === '' ? null : parseInt(body.kmFinal)) : existingUso.kmFinal;

        if (newKmFinal !== null && !isNaN(newKmFinal)) {
            dataToUpdate.kmFinal = newKmFinal;
            // Ensure we don't calculate negative distance
            const dist = newKmFinal - dataToUpdate.kmInicial;
            dataToUpdate.kmRecorridos = dist > 0 ? dist : 0;
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
