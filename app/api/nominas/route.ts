import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// GET /api/nominas?year=2024&month=5
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');
        const month = searchParams.get('month');

        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const user: any = await verifyToken(session);
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        if (!year || !month) return NextResponse.json({ error: 'Año y mes requeridos' }, { status: 400 });

        const whereCondition: any = { activo: true };

        // If not Admin, restrict to self
        if (user.rol !== 'ADMIN' && user.rol !== 'OFICINA') {
            whereCondition.id = user.id;
        }

        const details = searchParams.get('details') === 'true';

        // Get all employees (to show missing ones too)
        const empleados = await prisma.empleado.findMany({
            where: whereCondition,
            include: {
                nominas: {
                    where: {
                        year: parseInt(year),
                        month: parseInt(month)
                    },
                    include: details ? { lineas: { orderBy: { orden: 'asc' } } } : undefined
                }
            }
        });

        // Format result: List of employees with their payroll (if exists)
        const result = empleados.map(emp => ({
            empleado: {
                id: emp.id,
                nombre: emp.nombre,
                apellidos: emp.apellidos,
                rol: emp.rol
            },
            nomina: emp.nominas[0] || null // Should be 0 or 1 due to unique constraint
        }));

        return NextResponse.json(result);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
