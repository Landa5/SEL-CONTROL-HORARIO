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
            },
            include: { usosCamion: true }
        });

        if (orphans.length > 0) {
            const maxReasonableMs = 16 * 60 * 60 * 1000;
            for (const orphan of orphans) {
                const startMs = new Date(orphan.horaEntrada).getTime();
                let maxUsoFin: Date | null = null;
                for (const u of orphan.usosCamion) {
                    if (u.horaFin) {
                        const fin = new Date(u.horaFin);
                        const diff = fin.getTime() - startMs;
                        if (diff > 0 && diff <= maxReasonableMs) {
                            if (!maxUsoFin || fin > maxUsoFin) maxUsoFin = fin;
                        }
                    }
                }
                const effectiveEnd = maxUsoFin || new Date(startMs + 8 * 60 * 60 * 1000);
                const totalHoras = Math.round(((effectiveEnd.getTime() - startMs) / (1000 * 60 * 60)) * 100) / 100;

                await prisma.jornadaLaboral.update({
                    where: { id: orphan.id },
                    data: {
                        horaSalida: effectiveEnd,
                        totalHoras: Math.max(0, totalHoras),
                        estado: 'CERRADA',
                        observaciones: orphan.observaciones || 'Cierre automático por nueva entrada'
                    }
                });
            }
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

                // HOLIDAY DETECTION & COMPENSATION (Zona horaria Madrid)
                const madridParts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Europe/Madrid',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).formatToParts(current.fecha);
                const day = parseInt(madridParts.find(p => p.type === 'day')?.value || '1');
                const month = parseInt(madridParts.find(p => p.type === 'month')?.value || '1') - 1;
                const jYear = parseInt(madridParts.find(p => p.type === 'year')?.value || '2026');

                const allFiestas = await prisma.fiestaLocal.findMany({ where: { activa: true } });
                const matchingFiesta = allFiestas.find(f => {
                    const fParts = new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Europe/Madrid',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).formatToParts(f.fecha);
                    const fDay = parseInt(fParts.find(p => p.type === 'day')?.value || '1');
                    const fMonth = parseInt(fParts.find(p => p.type === 'month')?.value || '1') - 1;
                    const fYear = parseInt(fParts.find(p => p.type === 'year')?.value || '2026');

                    if (f.esAnual) {
                        return fDay === day && fMonth === month;
                    } else {
                        return fDay === day && fMonth === month && fYear === jYear;
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
