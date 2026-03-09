import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Obtener mantenimientos de un usoCamion
export async function GET(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const usoCamionId = searchParams.get('usoCamionId');

    if (!usoCamionId) {
        return NextResponse.json({ error: 'usoCamionId requerido' }, { status: 400 });
    }

    const registros = await prisma.mantenimientoConductor.findMany({
        where: { usoCamionId: parseInt(usoCamionId) },
        orderBy: { creadoEn: 'desc' }
    });

    return NextResponse.json(registros);
}

// POST: Crear un registro de mantenimiento
export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const usoCamionId: number = Number(body.usoCamionId);
    const aceite: boolean = Boolean(body.aceite);
    const litrosAceite: number | null = aceite && body.litrosAceite ? Number(body.litrosAceite) : null;
    const hidraulico: boolean = Boolean(body.hidraulico);
    const refrigerante: boolean = Boolean(body.refrigerante);
    const lavado: boolean = Boolean(body.lavado);
    const otroProducto: string | null = body.otroProducto || null;
    const observaciones: string | null = body.observaciones || null;

    if (!usoCamionId) {
        return NextResponse.json({ error: 'usoCamionId requerido' }, { status: 400 });
    }

    // Verificar que el UsoCamion existe y pertenece al empleado
    const uso = await prisma.usoCamion.findUnique({
        where: { id: usoCamionId },
        include: { jornada: true }
    });

    if (!uso) {
        return NextResponse.json({ error: 'Uso del camión no encontrado' }, { status: 404 });
    }

    if (session.rol === 'CONDUCTOR' && uso.jornada.empleadoId !== (session.id as number)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const registro = await prisma.mantenimientoConductor.create({
        data: {
            usoCamionId,
            aceite,
            litrosAceite,
            hidraulico,
            refrigerante,
            lavado,
            otroProducto,
            observaciones,
            empleadoId: session.id as number
        }
    });

    return NextResponse.json(registro, { status: 201 });
}
