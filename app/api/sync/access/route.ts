import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function autorizado(request: Request): boolean {
    const syncSecret = process.env.SYNC_SECRET || process.env.CRON_SECRET;
    if (!syncSecret) return false;
    const headerKey = request.headers.get('x-sync-key');
    const authHeader = request.headers.get('authorization');
    return headerKey === syncSecret || authHeader === `Bearer ${syncSecret}`;
}

export async function GET(request: Request) {
    if (!autorizado(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const url = new URL(request.url);
        const desdeParam = url.searchParams.get('desde');
        const desde = desdeParam ? new Date(desdeParam) : null;
        const filtroFecha = desde && !isNaN(desde.getTime()) ? { updatedAt: { gte: desde } } : {};

        const [
            empleados,
            camiones,
            jornadas,
            usosCamion,
            descargas,
            ausencias,
            tareas,
            tacografoResumen,
        ] = await Promise.all([
            prisma.empleado.findMany({
                include: { perfilProfesional: true },
                orderBy: { id: 'asc' },
            }),
            prisma.camion.findMany({
                orderBy: { id: 'asc' },
            }),
            prisma.jornadaLaboral.findMany({
                where: filtroFecha,
                include: { empleado: { select: { nombre: true, apellidos: true, dni: true } } },
                orderBy: { id: 'asc' },
            }),
            prisma.usoCamion.findMany({
                where: filtroFecha,
                include: {
                    camion: { select: { matricula: true } },
                    jornada: { select: { empleadoId: true, fecha: true, empleado: { select: { nombre: true, apellidos: true, dni: true } } } },
                },
                orderBy: { id: 'asc' },
            }),
            prisma.descarga.findMany({
                where: desde && !isNaN(desde.getTime()) ? { usoCamion: { updatedAt: { gte: desde } } } : {},
                include: {
                    usoCamion: {
                        select: {
                            jornadaId: true,
                            camionId: true,
                            camion: { select: { matricula: true } },
                            jornada: { select: { empleadoId: true } },
                        },
                    },
                },
                orderBy: { id: 'asc' },
            }),
            prisma.ausencia.findMany({
                where: filtroFecha,
                include: { empleado: { select: { nombre: true, apellidos: true, dni: true } } },
                orderBy: { id: 'asc' },
            }),
            prisma.tarea.findMany({
                where: filtroFecha,
                include: {
                    extensionTaller: true,
                    extensionReclamacion: true,
                    creadoPor: { select: { nombre: true, apellidos: true } },
                    asignadoA: { select: { nombre: true, apellidos: true } },
                },
                orderBy: { id: 'asc' },
            }),
            prisma.tachographDailySummary.findMany({
                where: filtroFecha,
                include: {
                    driver: { select: { fullName: true, cardNumber: true, linkedEmployeeId: true } },
                    vehicle: { select: { plateNumber: true, linkedVehicleId: true } },
                },
                orderBy: { id: 'asc' },
            }),
        ]);

        return NextResponse.json({
            ok: true,
            fechaServidor: new Date().toISOString(),
            empleados: empleados.map(e => ({
                id: e.id,
                usuario: e.usuario,
                activo: e.activo,
                nombre: e.nombre,
                apellidos: e.apellidos,
                dni: e.dni,
                telefono: e.telefono,
                email: e.email,
                direccion: e.direccion,
                rol: e.rol,
                puestoTrabajo: e.puestoTrabajo,
                fechaAlta: e.fechaAlta,
                fechaBaja: e.fechaBaja,
                horaEntradaPrevista: e.horaEntradaPrevista,
                horaSalidaPrevista: e.horaSalidaPrevista,
                diasVacaciones: e.diasVacaciones,
                diasExtras: e.diasExtras,
                horasExtra: e.horasExtra,
                dniCaducidad: e.perfilProfesional?.dniCaducidad ?? null,
                carnetTipo: e.perfilProfesional?.carnetTipo ?? null,
                carnetCaducidad: e.perfilProfesional?.carnetCaducidad ?? null,
                tieneAdr: e.perfilProfesional?.tieneAdr ?? false,
                adrCaducidad: e.perfilProfesional?.adrCaducidad ?? null,
                updatedAt: e.updatedAt,
            })),
            camiones: camiones.map(c => ({
                id: c.id,
                matricula: c.matricula,
                marca: c.marca,
                modelo: c.modelo,
                nVin: c.nVin,
                anio: c.anio,
                anioCisterna: c.anioCisterna,
                activo: c.activo,
                kmActual: c.kmActual,
                itvVencimiento: c.itvVencimiento,
                seguroVencimiento: c.seguroVencimiento,
                tacografoVencimiento: c.tacografoVencimiento,
                adrVencimiento: c.adrVencimiento,
                updatedAt: c.updatedAt,
            })),
            jornadas: jornadas.map(j => ({
                id: j.id,
                empleadoId: j.empleadoId,
                empleadoNombre: [j.empleado?.nombre, j.empleado?.apellidos].filter(Boolean).join(' ').trim(),
                empleadoDni: j.empleado?.dni ?? null,
                fecha: j.fecha,
                horaEntrada: j.horaEntrada,
                horaSalida: j.horaSalida,
                totalHoras: j.totalHoras,
                estado: j.estado,
                observaciones: j.observaciones,
                updatedAt: j.updatedAt,
            })),
            usosCamion: usosCamion.map(u => ({
                id: u.id,
                jornadaId: u.jornadaId,
                empleadoId: u.jornada?.empleadoId ?? null,
                empleadoNombre: [u.jornada?.empleado?.nombre, u.jornada?.empleado?.apellidos].filter(Boolean).join(' ').trim(),
                empleadoDni: u.jornada?.empleado?.dni ?? null,
                fechaJornada: u.jornada?.fecha ?? null,
                camionId: u.camionId,
                matricula: u.camion?.matricula ?? null,
                horaInicio: u.horaInicio,
                horaFin: u.horaFin,
                kmInicial: u.kmInicial,
                kmFinal: u.kmFinal,
                kmRecorridos: u.kmRecorridos ?? (u.kmFinal != null ? u.kmFinal - u.kmInicial : null),
                descargasCount: u.descargasCount,
                viajesCount: u.viajesCount,
                litrosRepostados: u.litrosRepostados,
                notas: u.notas,
                updatedAt: u.updatedAt,
            })),
            descargas: descargas.map(d => ({
                id: d.id,
                usoCamionId: d.usoCamionId,
                jornadaId: d.usoCamion?.jornadaId ?? null,
                empleadoId: d.usoCamion?.jornada?.empleadoId ?? null,
                camionId: d.usoCamion?.camionId ?? null,
                matricula: d.usoCamion?.camion?.matricula ?? null,
                hora: d.hora,
                litros: d.litros,
                tipoGasoil: d.tipoGasoil,
                lugar: d.lugar,
            })),
            ausencias: ausencias.map(a => ({
                id: a.id,
                empleadoId: a.empleadoId,
                empleadoNombre: [a.empleado?.nombre, a.empleado?.apellidos].filter(Boolean).join(' ').trim(),
                empleadoDni: a.empleado?.dni ?? null,
                tipo: a.tipo,
                fechaInicio: a.fechaInicio,
                fechaFin: a.fechaFin,
                horas: a.horas,
                estado: a.estado,
                observaciones: a.observaciones,
                fechaResolucion: a.fechaResolucion,
                updatedAt: a.updatedAt,
            })),
            tareas: tareas.map(t => ({
                id: t.id,
                tipo: t.tipo,
                estado: t.estado,
                prioridad: t.prioridad,
                visibilidad: t.visibilidad,
                areaResponsable: t.areaResponsable,
                titulo: t.titulo,
                descripcion: t.descripcion,
                activoTipo: t.activoTipo,
                matricula: t.matricula,
                clienteNombre: t.clienteNombre ?? t.extensionReclamacion?.clienteNombre ?? null,
                ubicacionTexto: t.ubicacionTexto,
                creadoPor: [t.creadoPor?.nombre, t.creadoPor?.apellidos].filter(Boolean).join(' ').trim(),
                asignadoA: [t.asignadoA?.nombre, t.asignadoA?.apellidos].filter(Boolean).join(' ').trim(),
                tipoAveria: t.extensionTaller?.tipoAveria ?? null,
                costeFinal: t.extensionTaller?.costeFinal ?? null,
                vehiculoInmovilizado: t.extensionTaller?.vehiculoInmovilizado ?? false,
                fechaInicio: t.fechaInicio,
                fechaLimite: t.fechaLimite,
                fechaCierre: t.fechaCierre,
                updatedAt: t.updatedAt,
            })),
            tacografoResumen: tacografoResumen.map(s => ({
                id: s.id,
                driverId: s.driverId,
                empleadoId: s.driver?.linkedEmployeeId ?? null,
                conductorNombre: s.driver?.fullName ?? null,
                tarjetaTacografo: s.driver?.cardNumber ?? null,
                vehicleId: s.vehicleId,
                camionId: s.vehicle?.linkedVehicleId ?? null,
                matricula: s.vehicle?.plateNumber ?? null,
                fecha: s.date,
                minutosConduccion: s.totalDrivingMinutes,
                minutosOtrosTrabajos: s.totalOtherWorkMinutes,
                minutosDisponibilidad: s.totalAvailabilityMinutes,
                minutosDescanso: s.totalRestMinutes,
                minutosPausa: s.totalBreakMinutes,
                estadoConsolidacion: s.dayConsolidationStatus,
                consistencia: s.consistencyStatus,
                updatedAt: s.updatedAt,
            })),
        });
    } catch (error: any) {
        console.error('Error en GET /api/sync/access:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (!autorizado(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const body = await request.json();
        let actualizadosComercial = 0;

        if (Array.isArray(body.comercialLitros)) {
            for (const item of body.comercialLitros) {
                const year = Number(item.year);
                const month = Number(item.month);
                const litros = Number(item.litros) || 0;
                if (!year || !month) continue;

                let emp = null;
                if (item.dni) {
                    emp = await prisma.empleado.findFirst({
                        where: { dni: { equals: String(item.dni).trim(), mode: 'insensitive' } },
                    });
                }
                if (!emp && item.empleadoId) {
                    emp = await prisma.empleado.findUnique({ where: { id: Number(item.empleadoId) } });
                }
                if (!emp) continue;

                await prisma.comercialLitros.upsert({
                    where: {
                        empleadoId_year_month: {
                            empleadoId: emp.id,
                            year,
                            month,
                        },
                    },
                    update: {
                        litros,
                        notas: item.notas ? String(item.notas) : 'Sincronizado desde SEL Central (BASE)',
                    },
                    create: {
                        empleadoId: emp.id,
                        year,
                        month,
                        litros,
                        notas: item.notas ? String(item.notas) : 'Sincronizado desde SEL Central (BASE)',
                    },
                });
                actualizadosComercial++;
            }
        }

        return NextResponse.json({
            ok: true,
            actualizadosComercial,
        });
    } catch (error: any) {
        console.error('Error en POST /api/sync/access:', error);
        return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
    }
}
