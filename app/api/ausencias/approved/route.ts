import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const approvedVacations = await prisma.ausencia.findMany({
            where: {
                estado: {
                    in: ['APROBADA', 'PENDIENTE']
                }
            },
            include: {
                empleado: {
                    select: {
                        id: true,
                        nombre: true,
                        apellidos: true,
                        rol: true
                    }
                }
            },
            orderBy: {
                fechaInicio: 'asc'
            }
        });

        return NextResponse.json(approvedVacations);
    } catch (error) {
        console.error("Error fetching approved vacations:", error);
        return NextResponse.json(
            { error: "Error fetching vacations" },
            { status: 500 }
        );
    }
}
