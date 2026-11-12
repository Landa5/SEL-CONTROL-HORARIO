import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { id } = await context.params;
        const empId = parseInt(id);
        if (isNaN(empId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        }

        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const empleado = await prisma.empleado.findUnique({
            where: { id: empId },
            include: {
                perfilProfesional: true,
                jornadas: {
                    orderBy: { fecha: 'desc' },
                    take: 40,
                    include: {
                        usosCamion: {
                            include: {
                                camion: { select: { id: true, matricula: true, modelo: true } }
                            }
                        }
                    }
                },
                ausencias: {
                    orderBy: { fechaInicio: 'desc' },
                    take: 30
                },
                nominas: {
                    orderBy: [{ year: 'desc' }, { month: 'desc' }],
                    take: 12,
                    include: { lineas: true }
                },
                resultadosFormacion: {
                    include: {
                        modulo: { select: { id: true, titulo: true, activo: true } }
                    }
                },
                evaluacionesRecibidas: {
                    orderBy: { fecha: 'desc' },
                    take: 10
                },
                tareasCreadas: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        camion: { select: { matricula: true } }
                    }
                },
                documentos: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!empleado) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        // Calculate annual operational KPIs
        const annualJornadas = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId: empId,
                fecha: { gte: startOfYear }
            },
            include: { usosCamion: true }
        });

        let annualHours = 0;
        let annualKm = 0;
        let annualViajes = 0;
        let annualDescargas = 0;
        let annualLitros = 0;

        annualJornadas.forEach(j => {
            annualHours += Number(j.totalHoras || 0);
            j.usosCamion.forEach(u => {
                const km =
                    typeof u.kmRecorridos === 'number' && u.kmRecorridos > 0
                        ? u.kmRecorridos
                        : typeof u.kmFinal === 'number' && typeof u.kmInicial === 'number' && u.kmFinal > u.kmInicial
                        ? u.kmFinal - u.kmInicial
                        : 0;
                annualKm += km;
                annualViajes += u.viajesCount || 0;
                annualDescargas += u.descargasCount || 0;
                annualLitros += u.litrosRepostados || 0;
            });
        });

        // Vacation balance calculation
        const totalVacacionesAnuales = empleado.diasVacaciones || 30;
        let vacacionesDisfrutadas = 0;
        let ausenciasTotalesDias = 0;

        empleado.ausencias.forEach((a: any) => {
            if (a.estado !== 'APROBADA') return;
            const y = new Date(a.fechaInicio).getFullYear();
            if (y !== now.getFullYear()) return;
            const days =
                Math.max(
                    1,
                    Math.ceil(
                        (new Date(a.fechaFin).getTime() - new Date(a.fechaInicio).getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1
                );
            if (a.tipo === 'VACACIONES') vacacionesDisfrutadas += days;
            else ausenciasTotalesDias += days;
        });

        // Tachograph linked driver info
        let tachoDriver = null;
        try {
            tachoDriver = await (prisma as any).tachographDriver.findFirst({
                where: { linkedEmployeeId: empId }
            });
        } catch {
            tachoDriver = null;
        }

        return NextResponse.json({
            empleado: {
                ...empleado,
                password: '***'
            },
            kpisAnuales: {
                year: now.getFullYear(),
                jornadasCount: annualJornadas.length,
                horas: Math.round(annualHours * 10) / 10,
                km: annualKm,
                viajes: annualViajes,
                descargas: annualDescargas,
                litros: annualLitros,
                consumoMedio: annualKm > 0 ? Math.round((annualLitros / annualKm) * 100 * 10) / 10 : 0,
                vacacionesTotales: totalVacacionesAnuales,
                vacacionesDisfrutadas,
                vacacionesPendientes: Math.max(0, totalVacacionesAnuales - vacacionesDisfrutadas),
                diasAusencia: ausenciasTotalesDias
            },
            tachoDriver
        });
    } catch (error) {
        console.error('Error in GET /api/admin/empleados/[id]/360:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
