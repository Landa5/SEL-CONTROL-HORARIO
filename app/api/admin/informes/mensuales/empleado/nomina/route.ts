import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// POST /api/admin/informes/mensuales/empleado/nomina
// Creates or updates an editable payroll draft from the individual monthly report
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const { empleadoId, year, month, lineas } = body;

        if (!empleadoId || !year || !month || !lineas || !Array.isArray(lineas)) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        // Find or create NominaMes
        let nomina = await prisma.nominaMes.findUnique({
            where: {
                empleadoId_year_month: {
                    empleadoId: parseInt(empleadoId),
                    year: parseInt(year),
                    month: parseInt(month)
                }
            },
            include: { lineas: true }
        });

        if (nomina && nomina.estado !== 'BORRADOR') {
            return NextResponse.json({ error: 'La nómina ya está cerrada o enviada. No se puede editar.' }, { status: 400 });
        }

        const userId = parseInt(user.id as string);

        // Process the incoming lines
        const processedLines = lineas.map((l: any, idx: number) => ({
            conceptoCodigo: l.codigo,
            conceptoNombre: l.nombre,
            cantidad: parseFloat(l.cantidad) || 0,
            rate: parseFloat(l.rate) || 0,
            importe: parseFloat(l.importe) || 0,
            override: true,
            notas: l.notas || null,
            updatedBy: userId,
            orden: idx
        }));

        const totalVariables = processedLines.reduce((sum: number, l: any) => sum + l.importe, 0);

        if (nomina) {
            // Update existing: Delete old lines and recreate
            await prisma.nominaLinea.deleteMany({ where: { nominaId: nomina.id } });

            await prisma.nominaMes.update({
                where: { id: nomina.id },
                data: {
                    totalVariables,
                    updatedAt: new Date(),
                    lineas: {
                        create: processedLines
                    }
                }
            });
        } else {
            // Create new draft
            nomina = await prisma.nominaMes.create({
                data: {
                    empleadoId: parseInt(empleadoId),
                    year: parseInt(year),
                    month: parseInt(month),
                    estado: 'BORRADOR',
                    totalVariables,
                    lineas: {
                        create: processedLines
                    }
                },
                include: { lineas: true }
            });
        }

        // Reload to return fresh data
        const result = await prisma.nominaMes.findUnique({
            where: {
                empleadoId_year_month: {
                    empleadoId: parseInt(empleadoId),
                    year: parseInt(year),
                    month: parseInt(month)
                }
            },
            include: { lineas: { orderBy: { orden: 'asc' } } }
        });

        return NextResponse.json({ message: 'Nómina guardada correctamente', nomina: result });

    } catch (error) {
        console.error('Error saving payroll from report:', error);
        return NextResponse.json({ error: 'Error interno guardando nómina' }, { status: 500 });
    }
}

// GET /api/admin/informes/mensuales/empleado/nomina?empleadoId=X&year=Y&month=M
// Fetches existing payroll draft for this employee/month
export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const empleadoId = searchParams.get('empleadoId');
        const year = searchParams.get('year');
        const month = searchParams.get('month');

        if (!empleadoId || !year || !month) {
            return NextResponse.json({ error: 'Parámetros requeridos' }, { status: 400 });
        }

        const nomina = await prisma.nominaMes.findUnique({
            where: {
                empleadoId_year_month: {
                    empleadoId: parseInt(empleadoId),
                    year: parseInt(year),
                    month: parseInt(month)
                }
            },
            include: { lineas: { orderBy: { orden: 'asc' } } }
        });

        return NextResponse.json({ nomina: nomina || null });

    } catch (error) {
        console.error('Error fetching payroll:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
