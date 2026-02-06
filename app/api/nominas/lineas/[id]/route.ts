import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// PATCH /api/nominas/lineas/[id]
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user = await verifyToken(session);

        if (!user || user.rol !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const body = await request.json();
        const { cantidad, rate, importe, notas } = body;

        // Verify parent nomina is editable
        const linea = await prisma.nominaLinea.findUnique({
            where: { id: parseInt(id) },
            include: { nomina: true }
        });

        if (!linea || linea.nomina.estado !== 'BORRADOR') {
            return NextResponse.json({ error: 'No se puede editar (linea no existe o nómina cerrada)' }, { status: 400 });
        }

        const updated = await prisma.nominaLinea.update({
            where: { id: parseInt(id) },
            data: {
                cantidad: cantidad !== undefined ? parseFloat(cantidad) : undefined,
                rate: rate !== undefined ? parseFloat(rate) : undefined,
                importe: importe !== undefined ? parseFloat(importe) : undefined,
                notas: notas,
                override: true,
                updatedBy: Number(user.id)
            }
        });

        // Update Total in Header
        // (Could trigger a re-calc or just sum active lines)
        const allLines = await prisma.nominaLinea.findMany({ where: { nominaId: linea.nominaId } });
        const newTotal = allLines.reduce((sum, l) => sum + l.importe, 0);

        await prisma.nominaMes.update({
            where: { id: linea.nominaId },
            data: { totalVariables: newTotal }
        });

        return NextResponse.json(updated);

    } catch (error) {
        return NextResponse.json({ error: 'Error editando línea' }, { status: 500 });
    }
}
