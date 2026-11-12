import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);

        const [
            ausenciasPendientes,
            tareasAbiertas,
            jornadasAbiertas,
            camionesVencimiento,
            empleadosVencimiento
        ] = await Promise.all([
            prisma.ausencia.count({ where: { estado: 'PENDIENTE' } }),
            prisma.tarea.count({
                where: {
                    estado: { notIn: ['COMPLETADA', 'CANCELADA'] }
                }
            }),
            prisma.jornadaLaboral.count({ where: { estado: 'TRABAJANDO' } }),
            prisma.camion.count({
                where: {
                    activo: true,
                    OR: [
                        { itvVencimiento: { lte: in30Days } },
                        { seguroVencimiento: { lte: in30Days } },
                        { tacografoVencimiento: { lte: in30Days } },
                        { adrVencimiento: { lte: in30Days } }
                    ]
                }
            }),
            prisma.empleado.count({
                where: {
                    activo: true,
                    perfilProfesional: {
                        OR: [
                            { dniCaducidad: { lte: in30Days } },
                            { carnetCaducidad: { lte: in30Days } },
                            { adrCaducidad: { lte: in30Days } }
                        ]
                    }
                }
            })
        ]);

        let tachoIncidencias = 0;
        try {
            tachoIncidencias = await (prisma as any).tachographIncident.count({
                where: { status: { not: 'RESOLVED' } }
            });
        } catch {
            tachoIncidencias = 0;
        }

        const vencimientosProximos = camionesVencimiento + empleadosVencimiento;
        const hoyTotal = ausenciasPendientes + tareasAbiertas + vencimientosProximos;

        return NextResponse.json({
            hoyTotal,
            ausenciasPendientes,
            tareasAbiertas,
            jornadasAbiertas,
            tachoIncidencias,
            vencimientosProximos
        });
    } catch (error) {
        console.error('Error fetching sidebar counts:', error);
        return NextResponse.json({
            hoyTotal: 0,
            ausenciasPendientes: 0,
            tareasAbiertas: 0,
            jornadasAbiertas: 0,
            tachoIncidencias: 0,
            vencimientosProximos: 0
        });
    }
}
