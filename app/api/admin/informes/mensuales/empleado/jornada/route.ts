import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// PATCH /api/admin/informes/mensuales/empleado/jornada
// Allows Admin / Oficina to quickly edit a day's shift (hours, KM, descargas, viajes, litros) directly from the Monthly Report
export async function PATCH(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const body = await request.json();
        const {
            jornadaId,
            usoId,
            empleadoId,
            date,       // "yyyy-MM-dd"
            startTime,  // "HH:mm"
            endTime,    // "HH:mm"
            km,
            descargas,
            viajes,
            litros
        } = body;

        if (!empleadoId || !date) {
            return NextResponse.json({ error: 'Empleado y fecha son obligatorios' }, { status: 400 });
        }

        const [year, month, day] = date.split('-').map(Number);
        const parseDayTime = (hhmm: string) => {
            const [h, m] = (hhmm || '08:00').split(':').map(Number);
            return new Date(year, month - 1, day, isNaN(h) ? 8 : h, isNaN(m) ? 0 : m, 0, 0);
        };

        const entradaDate = startTime ? parseDayTime(startTime) : new Date(year, month - 1, day, 8, 0, 0);
        const salidaDate = endTime ? parseDayTime(endTime) : new Date(year, month - 1, day, 16, 0, 0);
        const totalHoras = Math.max(0, Math.round(((salidaDate.getTime() - entradaDate.getTime()) / (1000 * 60 * 60)) * 100) / 100);

        let targetJornadaId = jornadaId ? Number(jornadaId) : null;

        if (targetJornadaId) {
            await prisma.jornadaLaboral.update({
                where: { id: targetJornadaId },
                data: {
                    horaEntrada: entradaDate,
                    horaSalida: salidaDate,
                    totalHoras,
                    estado: 'CERRADA',
                    observaciones: 'Editado desde Informe Mensual'
                }
            });
        } else {
            const created = await prisma.jornadaLaboral.create({
                data: {
                    empleadoId: Number(empleadoId),
                    fecha: entradaDate,
                    horaEntrada: entradaDate,
                    horaSalida: salidaDate,
                    totalHoras,
                    estado: 'CERRADA',
                    observaciones: 'Creado desde Informe Mensual'
                }
            });
            targetJornadaId = created.id;
        }

        // Update truck usage metrics (KM, descargas, viajes, litros) if provided
        const parsedKm = km !== undefined && km !== '' ? Number(km) : undefined;
        const parsedDesc = descargas !== undefined && descargas !== '' ? Number(descargas) : undefined;
        const parsedViajes = viajes !== undefined && viajes !== '' ? Number(viajes) : undefined;
        const parsedLitros = litros !== undefined && litros !== '' ? Number(litros) : undefined;

        const hasOperationalData = (parsedKm !== undefined && parsedKm >= 0) ||
            (parsedDesc !== undefined && parsedDesc >= 0) ||
            (parsedViajes !== undefined && parsedViajes >= 0) ||
            (parsedLitros !== undefined && parsedLitros >= 0);

        if (hasOperationalData && targetJornadaId) {
            // Find existing UsoCamion for this jornada
            let existingUso = usoId
                ? await prisma.usoCamion.findUnique({ where: { id: Number(usoId) } })
                : await prisma.usoCamion.findFirst({ where: { jornadaId: targetJornadaId }, orderBy: { id: 'asc' } });

            if (existingUso) {
                const newKmRec = parsedKm !== undefined ? Math.max(0, Math.round(parsedKm)) : (existingUso.kmRecorridos || 0);
                const newKmFinal = (existingUso.kmInicial || 0) + newKmRec;

                await prisma.usoCamion.update({
                    where: { id: existingUso.id },
                    data: {
                        horaFin: existingUso.horaFin || salidaDate,
                        kmRecorridos: newKmRec,
                        kmFinal: newKmFinal,
                        descargasCount: parsedDesc !== undefined ? Math.max(0, Math.round(parsedDesc)) : existingUso.descargasCount,
                        viajesCount: parsedViajes !== undefined ? Math.max(0, Math.round(parsedViajes)) : existingUso.viajesCount,
                        litrosRepostados: parsedLitros !== undefined ? Math.max(0, parsedLitros) : existingUso.litrosRepostados
                    }
                });

                // If there are additional UsoCamion rows in the same jornada and admin set the day's total, zero out duplicates to avoid double-counting
                const otherUsos = await prisma.usoCamion.findMany({
                    where: { jornadaId: targetJornadaId, id: { not: existingUso.id } }
                });
                if (otherUsos.length > 0) {
                    await prisma.usoCamion.updateMany({
                        where: { id: { in: otherUsos.map(u => u.id) } },
                        data: {
                            kmRecorridos: 0,
                            descargasCount: 0,
                            viajesCount: 0
                        }
                    });
                }
            } else if ((parsedKm && parsedKm > 0) || (parsedDesc && parsedDesc > 0) || (parsedViajes && parsedViajes > 0) || (parsedLitros && parsedLitros > 0)) {
                // Find the employee's most recently used truck or first active truck
                const lastEmpUso = await prisma.usoCamion.findFirst({
                    where: { jornada: { empleadoId: Number(empleadoId) } },
                    orderBy: { id: 'desc' }
                });
                const fallbackTruck = lastEmpUso
                    ? { id: lastEmpUso.camionId, kmActual: lastEmpUso.kmFinal || 0 }
                    : await prisma.camion.findFirst({ where: { activo: true }, select: { id: true, kmActual: true } });

                if (fallbackTruck) {
                    const kmIni = fallbackTruck.kmActual || 0;
                    const kmRec = Math.max(0, Math.round(parsedKm || 0));
                    await prisma.usoCamion.create({
                        data: {
                            jornadaId: targetJornadaId,
                            camionId: fallbackTruck.id,
                            horaInicio: entradaDate,
                            horaFin: salidaDate,
                            kmInicial: kmIni,
                            kmFinal: kmIni + kmRec,
                            kmRecorridos: kmRec,
                            descargasCount: Math.max(0, Math.round(parsedDesc || 0)),
                            viajesCount: Math.max(0, Math.round(parsedViajes || 0)),
                            litrosRepostados: Math.max(0, parsedLitros || 0)
                        }
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, jornadaId: targetJornadaId });
    } catch (error) {
        console.error('PATCH /api/admin/informes/mensuales/empleado/jornada error:', error);
        return NextResponse.json({ error: 'Error al actualizar el registro' }, { status: 500 });
    }
}
