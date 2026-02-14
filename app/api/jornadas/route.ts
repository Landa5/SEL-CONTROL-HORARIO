import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const dateStr = searchParams.get('date'); // YYYY-MM-DD
        const adminView = searchParams.get('admin');

        if (adminView === 'true' && (user.rol === 'ADMIN' || user.rol === 'OFICINA')) {
            const empId = searchParams.get('empleadoId');
            const monthStr = searchParams.get('month'); // YYYY-MM

            const where: any = {};
            if (empId) {
                where.empleadoId = parseInt(empId);
            }

            // If office staff, only show conductors
            if (user.rol === 'OFICINA') {
                where.empleado = { rol: 'CONDUCTOR' };
            }

            if (monthStr) {
                const [year, month] = monthStr.split('-').map(Number);
                where.fecha = {
                    gte: new Date(year, month - 1, 1),
                    lte: new Date(year, month, 0, 23, 59, 59)
                };
            }

            const jornadas = await prisma.jornadaLaboral.findMany({
                where,
                include: {
                    empleado: { select: { id: true, nombre: true, email: true, rol: true } },
                    usosCamion: { include: { camion: true, descargas: true } }
                },
                orderBy: { fecha: 'desc' }
            });
            return NextResponse.json(jornadas);
        }

        if (dateStr) {
            const todayStart = new Date(dateStr);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(dateStr);
            todayEnd.setHours(23, 59, 59, 999);

            const jornada = await prisma.jornadaLaboral.findFirst({
                where: {
                    empleadoId: parseInt(user.id),
                    fecha: {
                        gte: todayStart,
                        lte: todayEnd,
                    },
                },
                include: {
                    usosCamion: { include: { descargas: true, camion: true } }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
            return NextResponse.json(jornada || null);
        }

        // Default list view
        const where: any = { empleadoId: parseInt(user.id) };
        const monthStr = searchParams.get('month');
        if (monthStr) {
            const [year, month] = monthStr.split('-').map(Number);
            where.fecha = {
                gte: new Date(year, month - 1, 1),
                lte: new Date(year, month, 0, 23, 59, 59)
            };
        }

        const jornadas = await prisma.jornadaLaboral.findMany({
            where,
            include: {
                usosCamion: { include: { camion: true, descargas: true } }
            },
            orderBy: { fecha: 'desc' }
        });
        return NextResponse.json(jornadas);
    } catch (error) {
        console.error('GET /api/jornadas error:', error);
        return NextResponse.json({ error: 'Error al obtener jornadas' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const body = await request.json();
        const { fecha, horaEntrada, estado, observaciones } = body;
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // RULE: Auto-close orphaned shifts from previous days
        const orphans = await prisma.jornadaLaboral.findMany({
            where: {
                empleadoId: Number(user.id),
                horaSalida: null,
                fecha: { lt: startOfToday }
            }
        });

        if (orphans.length > 0) {
            await prisma.jornadaLaboral.updateMany({
                where: { id: { in: orphans.map(o => o.id) } },
                data: {
                    horaSalida: now,
                    estado: 'CERRADA',
                    observaciones: 'Cierre automático por nueva entrada'
                }
            });
        }

        // STILL RULE: Cannot have two entries on the SAME day without an exit
        const activeToday = await prisma.jornadaLaboral.findFirst({
            where: {
                empleadoId: Number(user.id),
                horaSalida: null,
                fecha: { gte: startOfToday }
            }
        });

        if (activeToday) return NextResponse.json({ error: 'Ya tienes una jornada activa hoy sin cerrar' }, { status: 400 });

        const jornada = await prisma.jornadaLaboral.create({
            data: {
                empleadoId: Number(user.id),
                fecha: new Date(fecha),
                horaEntrada: new Date(horaEntrada),
                estado: estado || 'TRABAJANDO',
                observaciones
            }
        });

        return NextResponse.json(jornada);
    } catch (error) {
        console.error('POST /api/jornadas error:', error);
        return NextResponse.json({ error: 'Error al iniciar jornada' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !user.id) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const body = await request.json();
        const { id, horaSalida, estado, observaciones } = body;

        if (!id) return NextResponse.json({ error: 'ID de jornada requerido' }, { status: 400 });

        const data: any = {};
        if (horaSalida) {
            const hSalida = new Date(horaSalida);
            data.horaSalida = hSalida;
            data.estado = 'CERRADA';

            const current = await prisma.jornadaLaboral.findUnique({
                where: { id: parseInt(id) },
                include: { empleado: true }
            });

            if (current) {
                const diff = hSalida.getTime() - current.horaEntrada.getTime();
                const totalHours = parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
                data.totalHoras = totalHours;

                // HOLIDAY DETECTION & COMPENSATION
                const jDate = new Date(current.fecha);
                const day = jDate.getDate();
                const month = jDate.getMonth();

                // Find active holiday on this date
                const fiesta = await prisma.fiestaLocal.findFirst({
                    where: {
                        activa: true,
                        OR: [
                            {
                                // Specific date
                                fecha: {
                                    gte: new Date(jDate.getFullYear(), month, day, 0, 0, 0),
                                    lte: new Date(jDate.getFullYear(), month, day, 23, 59, 59)
                                }
                            },
                            {
                                // Annual holiday (same day/month)
                                esAnual: true,
                                fecha: {
                                    // We check if it matches month/day via Prisma query or just fetch and filter
                                    // SQLite doesn't have easy DATE_PART, so let's check a range or fetch and filter
                                }
                            }
                        ]
                    }
                });

                // Since SQLite doesn't support complex date functions easily in Prisma where, 
                // let's fetch active holidays and filter manually for simplicity and reliability.
                const allFiestas = await prisma.fiestaLocal.findMany({ where: { activa: true } });
                const matchingFiesta = allFiestas.find(f => {
                    const fDate = new Date(f.fecha);
                    if (f.esAnual) {
                        return fDate.getDate() === day && fDate.getMonth() === month;
                    } else {
                        return fDate.getDate() === day && fDate.getMonth() === month && fDate.getFullYear() === jDate.getFullYear();
                    }
                });

                if (matchingFiesta) {
                    // Check if already compensated
                    const existingComp = await prisma.compensacionFestivo.findUnique({
                        where: { jornadaId: parseInt(id) }
                    });

                    if (!existingComp) {
                        const rol = current.empleado.rol;
                        const isDriverOrMech = rol === 'CONDUCTOR' || rol === 'MECANICO';

                        await prisma.compensacionFestivo.create({
                            data: {
                                empleadoId: current.empleadoId,
                                jornadaId: parseInt(id),
                                fiestaId: matchingFiesta.id,
                                tipo: isDriverOrMech ? 'DIA_VACACIONES' : 'HORAS_EXTRA',
                                valor: isDriverOrMech ? 1 : totalHours,
                                motivo: `Compensación por fiesta local trabajada: ${matchingFiesta.nombre}`
                            }
                        });

                        // Update balances
                        if (isDriverOrMech) {
                            await prisma.empleado.update({
                                where: { id: current.empleadoId },
                                data: { diasExtras: { increment: 1 } }
                            });
                        } else {
                            await prisma.empleado.update({
                                where: { id: current.empleadoId },
                                data: { horasExtra: { increment: totalHours } }
                            });
                        }
                    }
                }
            }
        }
        if (estado) data.estado = estado;
        if (observaciones) data.observaciones = observaciones;

        const jornada = await prisma.jornadaLaboral.update({
            where: { id: parseInt(id) },
            data,
        });

        // AUDITORÍA
        await registrarAuditoria(
            parseInt(user.id),
            'EDICION_JORNADA',
            'JornadaLaboral',
            jornada.id,
            data
        );

        return NextResponse.json(jornada);
    } catch (error) {
        console.error('PUT /api/jornadas error:', error);
        return NextResponse.json({ error: 'Error al actualizar jornada' }, { status: 500 });
    }
}
