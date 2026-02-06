import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA' && user.rol !== 'MECANICO')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { id, marca, modelo, nVin, anio, anioCisterna, itvVencimiento, seguroVencimiento, tacografoVencimiento, adrVencimiento } = body;

        console.log('Updating truck metadata:', { id, anio, anioCisterna, itvVencimiento });

        // Helper to parse integers safely
        const safeInt = (val: any) => {
            if (val === null || val === undefined || val === '') return null;
            const parsed = parseInt(val);
            return isNaN(parsed) ? null : parsed;
        };

        // Helper to parse dates safely
        const safeDate = (val: any) => {
            if (!val || val === '') return null;
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        };

        const camion = await prisma.camion.update({
            where: { id: parseInt(id.toString()) },
            data: {
                marca: marca || null,
                modelo: modelo || null,
                nVin: nVin || null,
                anio: safeInt(anio),
                anioCisterna: safeInt(anioCisterna),
                itvVencimiento: safeDate(itvVencimiento),
                seguroVencimiento: safeDate(seguroVencimiento),
                tacografoVencimiento: safeDate(tacografoVencimiento),
                adrVencimiento: safeDate(adrVencimiento),
            }
        });

        return NextResponse.json(camion);
    } catch (error) {
        console.error('PUT /api/camiones/metadata error:', error);
        return NextResponse.json({ error: 'Error al actualizar ficha técnica' }, { status: 500 });
    }
}
