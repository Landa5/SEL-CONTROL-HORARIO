import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/nominas/comercial?year=2024&month=5
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');
        const month = searchParams.get('month');

        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session || !['ADMIN', 'OFICINA', 'COMERCIAL'].includes(((await verifyToken(session))?.rol || ''))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        if (!year || !month) {
            return NextResponse.json({ error: 'Faltan parámetros year y month' }, { status: 400 });
        }

        const liters = await prisma.comercialLitros.findMany({
            where: {
                year: parseInt(year),
                month: parseInt(month)
            },
            include: {
                empleado: {
                    select: { id: true, nombre: true, apellidos: true }
                }
            }
        });

        return NextResponse.json(liters);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error obteniendo litros' }, { status: 500 });
    }
}

// POST /api/nominas/comercial
// Upserts liters for a commercial employee for a specific month
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        const user = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
            // Commercials might be able to input their own data? Prompt says "Editable and exportable to agency".
            // Context says "First version: manual monthly entry". 
            // Usually Admin/Office enters this, but let's restrict to Admin/Office for now to manage "variables".
            return NextResponse.json({ error: 'No autorizado para modificar' }, { status: 403 });
        }

        const body = await request.json();
        const { empleadoId, year, month, litros, notas } = body;

        if (!empleadoId || !year || !month || litros === undefined) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const record = await prisma.comercialLitros.upsert({
            where: {
                empleadoId_year_month: {
                    empleadoId: parseInt(empleadoId),
                    year: parseInt(year),
                    month: parseInt(month)
                }
            },
            update: {
                litros: parseFloat(litros),
                notas: notas,
                updatedBy: Number(user.id)
            },
            create: {
                empleadoId: parseInt(empleadoId),
                year: parseInt(year),
                month: parseInt(month),
                litros: parseFloat(litros),
                notas: notas,
                updatedBy: Number(user.id)
            }
        });

        return NextResponse.json(record);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error guardando litros' }, { status: 500 });
    }
}
