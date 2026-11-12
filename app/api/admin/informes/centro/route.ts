import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const PRECIO_LITRO_ESTIMADO = 1.48; // €/L medio gasóleo profesional

function calcKmTurno(u: { kmRecorridos?: number | null; kmInicial?: number | null; kmFinal?: number | null }): number {
    if (typeof u.kmRecorridos === 'number' && u.kmRecorridos > 0) return u.kmRecorridos;
    if (typeof u.kmFinal === 'number' && typeof u.kmInicial === 'number' && u.kmFinal >= u.kmInicial) {
        return u.kmFinal - u.kmInicial;
    }
    return 0;
}

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['ADMIN', 'OFICINA'].includes(String(session.rol))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const now = new Date();
        const year = Number(searchParams.get('year')) || now.getFullYear();
        const month = Number(searchParams.get('month')) || (now.getMonth() + 1); // 1..12

        const startDateParam = searchParams.get('desde');
        const endDateParam = searchParams.get('hasta');

        const startDate = startDateParam
            ? new Date(`${startDateParam}T00:00:00.000Z`)
            : new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
        const endDate = endDateParam
            ? new Date(`${endDateParam}T23:59:59.999Z`)
            : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

        const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

        const [
            empleados,
            camiones,
            jornadasPeriodo,
            ausenciasPeriodo,
            ausenciasAnuales,
            tareasPeriodo,
            mantenimientosPeriodo,
            tachoIncidents,
            tachoFindings,
        ] = await Promise.all([
            prisma.empleado.findMany({
                where: { activo: true },
                include: {
                    perfilProfesional: true,
                    tachographDriverLink: true,
                },
                orderBy: { nombre: 'asc' },
            }),
            prisma.camion.findMany({
                where: { activo: true },
                orderBy: { matricula: 'asc' },
            }),
            prisma.jornadaLaboral.findMany({
                where: {
                    fecha: { gte: startDate, lte: endDate },
                },
                include: {
                    empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } },
                    usosCamion: {
                        include: {
                            camion: { select: { id: true, matricula: true, marca: true, modelo: true } },
                            descargas: true,
                        },
                    },
                },
            }),
            prisma.ausencia.findMany({
                where: {
                    fechaInicio: { lte: endDate },
                    fechaFin: { gte: startDate },
                    estado: { in: ['APROBADA', 'PENDIENTE'] },
                },
                include: {
                    empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } },
                },
            }),
            prisma.ausencia.findMany({
                where: {
                    fechaInicio: { lte: endOfYear },
                    fechaFin: { gte: startOfYear },
                    estado: { in: ['APROBADA', 'PENDIENTE'] },
                },
            }),
            prisma.tarea.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
                include: {
                    camion: { select: { id: true, matricula: true } },
                    extensionTaller: true,
                },
            }),
            prisma.mantenimientoRealizado.findMany({
                where: {
                    fecha: { gte: startDate, lte: endDate },
                },
                include: {
                    camion: { select: { id: true, matricula: true } },
                },
            }),
            prisma.tachographIncident.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
                include: {
                    driver: {
                        include: {
                            linkedEmployee: { select: { id: true, nombre: true, apellidos: true } },
                        },
                    },
                    vehicle: { select: { id: true, plateNumber: true } },
                },
            }),
            prisma.tachographRegulationFinding.findMany({
                where: {
                    dateFrom: { gte: startDate, lte: endDate },
                    result: { in: ['NON_COMPLIANT', 'POTENTIAL_NON_COMPLIANCE'] },
                },
                include: {
                    driver: {
                        include: {
                            linkedEmployee: { select: { id: true, nombre: true, apellidos: true } },
                        },
                    },
                },
            }),
        ]);

        // =========================================================================
        // 1. VENCIMIENTOS A 30, 60 Y 90 DÍAS (Flota + Conductores)
        // =========================================================================
        const vencimientos: Array<{
            id: string;
            categoria: 'VEHICULO' | 'EMPLEADO';
            titular: string;
            documento: string;
            fechaCaducidad: string;
            diasRestantes: number;
            plazo: 'CADUCADO' | '30_DIAS' | '60_DIAS' | '90_DIAS' | 'MAS_90_DIAS';
            href: string;
        }> = [];

        const pushExpiration = (
            id: string,
            categoria: 'VEHICULO' | 'EMPLEADO',
            titular: string,
            documento: string,
            dateVal: Date | null | undefined,
            href: string
        ) => {
            if (!dateVal) return;
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return;
            const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 120) return; // mostramos hasta 120 días de horizonte
            let plazo: 'CADUCADO' | '30_DIAS' | '60_DIAS' | '90_DIAS' | 'MAS_90_DIAS' = 'MAS_90_DIAS';
            if (diffDays < 0) plazo = 'CADUCADO';
            else if (diffDays <= 30) plazo = '30_DIAS';
            else if (diffDays <= 60) plazo = '60_DIAS';
            else if (diffDays <= 90) plazo = '90_DIAS';

            vencimientos.push({
                id,
                categoria,
                titular,
                documento,
                fechaCaducidad: d.toISOString().split('T')[0],
                diasRestantes: diffDays,
                plazo,
                href,
            });
        };

        for (const c of camiones) {
            const label = `${c.matricula} ${c.modelo ? `(${c.modelo})` : ''}`.trim();
            pushExpiration(`cam-itv-${c.id}`, 'VEHICULO', label, 'ITV Vehículo', c.itvVencimiento, `/admin/camiones/${c.id}`);
            pushExpiration(`cam-seg-${c.id}`, 'VEHICULO', label, 'Seguro Flota', c.seguroVencimiento, `/admin/camiones/${c.id}`);
            pushExpiration(`cam-tac-${c.id}`, 'VEHICULO', label, 'Revisión Tacógrafo', c.tacografoVencimiento, `/admin/camiones/${c.id}`);
            pushExpiration(`cam-adr-${c.id}`, 'VEHICULO', label, 'Certificado ADR Cisterna', c.adrVencimiento, `/admin/camiones/${c.id}`);
        }

        for (const e of empleados) {
            const fullName = `${e.nombre} ${e.apellidos || ''}`.trim();
            const perf = e.perfilProfesional;
            if (perf) {
                pushExpiration(`emp-dni-${e.id}`, 'EMPLEADO', fullName, 'DNI / NIE', perf.dniCaducidad, `/admin/empleados/${e.id}`);
                pushExpiration(`emp-car-${e.id}`, 'EMPLEADO', fullName, `Carnet Conducir (${perf.carnetTipo || 'C+E'})`, perf.carnetCaducidad, `/admin/empleados/${e.id}`);
                if (perf.tieneAdr && perf.adrCaducidad) {
                    pushExpiration(`emp-adr-${e.id}`, 'EMPLEADO', fullName, 'Carnet ADR Conductor', perf.adrCaducidad, `/admin/empleados/${e.id}`);
                }
            }
        }
        vencimientos.sort((a, b) => a.diasRestantes - b.diasRestantes);

        // =========================================================================
        // 2. COSTE POR KM Y POR CAMIÓN (Combustible + Taller + Recambios)
        // =========================================================================
        const costeKm = camiones.map((c) => {
            let kmPeriodo = 0;
            let litrosRepostados = 0;
            let turnosCount = 0;

            for (const j of jornadasPeriodo) {
                for (const u of j.usosCamion) {
                    if (u.camionId === c.id) {
                        kmPeriodo += calcKmTurno(u);
                        litrosRepostados += Number(u.litrosRepostados || 0);
                        turnosCount++;
                    }
                }
            }

            const costeCombustible = Math.round(litrosRepostados * PRECIO_LITRO_ESTIMADO * 100) / 100;

            const mantsCamion = mantenimientosPeriodo.filter((m) => m.camionId === c.id);
            const tareasCamion = tareasPeriodo.filter((t) => t.camionId === c.id);

            const costeMantenimientos = mantsCamion.reduce((acc, m) => acc + Number(m.costo || 0), 0);
            const costeTareasTaller = tareasCamion.reduce(
                (acc, t) => acc + Number(t.extensionTaller?.costeFinal || t.extensionTaller?.costeEstimado || 0),
                0
            );
            const costeTallerTotal = Math.round((costeMantenimientos + costeTareasTaller) * 100) / 100;
            const costeTotal = Math.round((costeCombustible + costeTallerTotal) * 100) / 100;
            const eurPorKm = kmPeriodo > 0 ? Math.round((costeTotal / kmPeriodo) * 1000) / 1000 : 0;

            let estadoRentabilidad = 'ÓPTIMO';
            if (eurPorKm > 1.2 || (costeTallerTotal > 2500 && kmPeriodo < 2000)) {
                estadoRentabilidad = 'EVALUAR RENOVACIÓN';
            } else if (eurPorKm > 0.75 || costeTallerTotal > 1000) {
                estadoRentabilidad = 'VIGILAR COSTE';
            }

            return {
                id: c.id,
                matricula: c.matricula,
                modelo: `${c.marca || ''} ${c.modelo || ''}`.trim() || 'Cisterna',
                kmActualOdometro: c.kmActual || 0,
                kmPeriodo,
                turnosCount,
                litrosRepostados: Math.round(litrosRepostados * 10) / 10,
                costeCombustible,
                costeTallerTotal,
                averiasPeriodo: tareasCamion.length,
                costeTotal,
                eurPorKm,
                estadoRentabilidad,
            };
        }).sort((a, b) => b.costeTotal - a.costeTotal);

        // =========================================================================
        // 3. CONSUMO DE COMBUSTIBLE (L/100 KM por Camión y Conductor)
        // =========================================================================
        const consumoPorCamionMap = new Map<string, {
            id: string;
            tipo: 'CAMIÓN' | 'CONDUCTOR';
            nombre: string;
            subtitulo: string;
            kmRecorridos: number;
            litrosRepostados: number;
            viajes: number;
            descargas: number;
        }>();

        for (const j of jornadasPeriodo) {
            const empName = `${j.empleado?.nombre || ''} ${j.empleado?.apellidos || ''}`.trim() || 'Conductor';
            for (const u of j.usosCamion) {
                const km = calcKmTurno(u);
                const litros = Number(u.litrosRepostados || 0);
                const desc = u.descargasCount > 0 ? u.descargasCount : (u.descargas?.length || 0);
                const viajes = Number(u.viajesCount || 0);

                if (u.camion) {
                    const camKey = `CAM-${u.camion.id}`;
                    const prevCam = consumoPorCamionMap.get(camKey) || {
                        id: camKey,
                        tipo: 'CAMIÓN' as const,
                        nombre: u.camion.matricula,
                        subtitulo: `${u.camion.marca || ''} ${u.camion.modelo || ''}`.trim() || 'Vehículo',
                        kmRecorridos: 0,
                        litrosRepostados: 0,
                        viajes: 0,
                        descargas: 0,
                    };
                    prevCam.kmRecorridos += km;
                    prevCam.litrosRepostados += litros;
                    prevCam.viajes += viajes;
                    prevCam.descargas += desc;
                    consumoPorCamionMap.set(camKey, prevCam);
                }

                const empKey = `EMP-${j.empleadoId}`;
                const prevEmp = consumoPorCamionMap.get(empKey) || {
                    id: empKey,
                    tipo: 'CONDUCTOR' as const,
                    nombre: empName,
                    subtitulo: j.empleado?.rol || 'CONDUCTOR',
                    kmRecorridos: 0,
                    litrosRepostados: 0,
                    viajes: 0,
                    descargas: 0,
                };
                prevEmp.kmRecorridos += km;
                prevEmp.litrosRepostados += litros;
                prevEmp.viajes += viajes;
                prevEmp.descargas += desc;
                consumoPorCamionMap.set(empKey, prevEmp);
            }
        }

        const consumo = Array.from(consumoPorCamionMap.values())
            .filter((item) => item.kmRecorridos > 0 || item.litrosRepostados > 0)
            .map((item) => {
                const l100km = item.kmRecorridos > 0
                    ? Math.round(((item.litrosRepostados / item.kmRecorridos) * 100) * 10) / 10
                    : 0;
                // Referencia flota pesada reparto gasóleo ~32 L/100km
                const desviacion = l100km > 0 ? Math.round((l100km - 32) * 10) / 10 : 0;
                let estadoConsumo = 'NORMAL';
                if (l100km > 42) estadoConsumo = 'DESVÍO ALTO';
                else if (l100km > 35) estadoConsumo = 'CONSUMO ELEVADO';
                else if (l100km > 0 && l100km < 12) estadoConsumo = 'REPOSTAJE PARCIAL';

                return {
                    ...item,
                    litrosRepostados: Math.round(item.litrosRepostados * 10) / 10,
                    l100km,
                    desviacion,
                    estadoConsumo,
                };
            })
            .sort((a, b) => b.l100km - a.l100km);

        // =========================================================================
        // 4. HORAS EXTRA Y CUMPLIMIENTO DE JORNADA
        // =========================================================================
        const horasExtra = empleados.map((e) => {
            const misJornadas = jornadasPeriodo.filter((j) => j.empleadoId === e.id);
            let horasTrabajadas = 0;
            let jornadasSinCerrar = 0;
            let retrasosEntrada = 0;

            for (const j of misJornadas) {
                if (!j.horaSalida) {
                    jornadasSinCerrar++;
                }
                const h = typeof j.totalHoras === 'number' && j.totalHoras > 0
                    ? j.totalHoras
                    : j.horaSalida
                        ? Math.max(0, (new Date(j.horaSalida).getTime() - new Date(j.horaEntrada).getTime()) / (1000 * 60 * 60))
                        : 0;
                horasTrabajadas += h;

                if (e.horaEntradaPrevista) {
                    const [hh, mm] = e.horaEntradaPrevista.split(':').map(Number);
                    if (!isNaN(hh) && !isNaN(mm)) {
                        const ent = new Date(j.horaEntrada);
                        const minEntrada = ent.getHours() * 60 + ent.getMinutes();
                        const minPrevisto = hh * 60 + mm;
                        if (minEntrada > minPrevisto + 15) retrasosEntrada++;
                    }
                }
            }

            const diasTrabajados = misJornadas.length;
            const horasOrdinarias = diasTrabajados * 8;
            const excesoHorasPeriodo = Math.max(0, Math.round((horasTrabajadas - horasOrdinarias) * 10) / 10);
            const mediaHorasDia = diasTrabajados > 0 ? Math.round((horasTrabajadas / diasTrabajados) * 10) / 10 : 0;
            const cumplimientoPct = diasTrabajados > 0
                ? Math.max(0, Math.round(((diasTrabajados - jornadasSinCerrar) / diasTrabajados) * 100))
                : 100;

            return {
                id: e.id,
                empleado: `${e.nombre} ${e.apellidos || ''}`.trim(),
                rol: e.rol,
                diasTrabajados,
                horasTrabajadas: Math.round(horasTrabajadas * 10) / 10,
                horasOrdinarias,
                horasExtraPeriodo: excesoHorasPeriodo,
                mediaHorasDia,
                jornadasSinCerrar,
                retrasosEntrada,
                cumplimientoPct,
            };
        }).sort((a, b) => b.horasExtraPeriodo - a.horasExtraPeriodo);

        // =========================================================================
        // 5. INFRACCIONES DE TACÓGRAFO POR CONDUCTOR (Tendencia y Formación)
        // =========================================================================
        const conductoresList = empleados.filter((e) => e.rol === 'CONDUCTOR' || e.tachographDriverLink.length > 0);
        const tacografoInfracciones = conductoresList.map((e) => {
            const driverIds = e.tachographDriverLink.map((d) => d.id);
            const incConductor = tachoIncidents.filter(
                (i) => (i.driverId && driverIds.includes(i.driverId)) || i.driver?.linkedEmployeeId === e.id
            );
            const findConductor = tachoFindings.filter(
                (f) => driverIds.includes(f.driverId) || f.driver?.linkedEmployeeId === e.id
            );

            const leves = incConductor.filter((i) => i.severity === 'LOW').length +
                findConductor.filter((f) => f.severity === 'INFO').length;
            const graves = incConductor.filter((i) => i.severity === 'MEDIUM' || i.severity === 'HIGH').length +
                findConductor.filter((f) => f.severity === 'WARNING').length;
            const muyGraves = incConductor.filter((i) => i.severity === 'CRITICAL').length +
                findConductor.filter((f) => f.severity === 'VIOLATION').length;

            const totalInfracciones = leves + graves + muyGraves;
            const excesoConduccion = findConductor.filter((f) => f.ruleCategory === 'DRIVING_TIME').length;
            const faltaDescanso = findConductor.filter((f) => f.ruleCategory === 'REST_TIME' || f.ruleCategory === 'BREAK_TIME').length;

            let accionRecomendada = 'Cumplimiento correcto';
            if (muyGraves > 0 || totalInfracciones >= 5) {
                accionRecomendada = '⚠️ Programar formación CE 561/2006 urgente';
            } else if (graves > 0 || totalInfracciones >= 2) {
                accionRecomendada = 'Revisar pausas de 4h30 y descansos diarios';
            }

            return {
                id: e.id,
                conductor: `${e.nombre} ${e.apellidos || ''}`.trim(),
                tarjetaVinculada: e.tachographDriverLink[0]?.cardNumber || 'Sin vincular',
                leves,
                graves,
                muyGraves,
                totalInfracciones,
                excesoConduccion,
                faltaDescanso,
                accionRecomendada,
            };
        }).sort((a, b) => b.totalInfracciones - a.totalInfracciones);

        // =========================================================================
        // 6. ABSENTISMO (Tasa por Empleado, Mes y Tipo de Ausencia)
        // =========================================================================
        const diasPeriodoTotal = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const diasLaborablesBase = Math.max(1, Math.round((diasPeriodoTotal * 5) / 7));

        const absentismo = empleados.map((e) => {
            const misAus = ausenciasPeriodo.filter((a) => a.empleadoId === e.id);
            let diasBaja = 0;
            let diasPermiso = 0;
            let diasVacaciones = 0;
            let diasOtros = 0;

            for (const a of misAus) {
                const ini = new Date(Math.max(new Date(a.fechaInicio).getTime(), startDate.getTime()));
                const fin = new Date(Math.min(new Date(a.fechaFin).getTime(), endDate.getTime()));
                const days = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                if (a.tipo === 'BAJA') diasBaja += days;
                else if (a.tipo === 'PERMISO') diasPermiso += days;
                else if (a.tipo === 'VACACIONES') diasVacaciones += days;
                else diasOtros += days;
            }

            const diasAusenciaNoVacacional = diasBaja + diasPermiso + diasOtros;
            const tasaAbsentismoPct = Math.min(
                100,
                Math.round(((diasAusenciaNoVacacional / diasLaborablesBase) * 100) * 10) / 10
            );

            return {
                id: e.id,
                empleado: `${e.nombre} ${e.apellidos || ''}`.trim(),
                rol: e.rol,
                diasLaborablesBase,
                diasBaja,
                diasPermiso,
                diasVacaciones,
                diasAusenciaNoVacacional,
                tasaAbsentismoPct,
            };
        }).sort((a, b) => b.tasaAbsentismoPct - a.tasaAbsentismoPct);

        // =========================================================================
        // 7. SALDO DE VACACIONES (Pendientes por Empleado en el Año)
        // =========================================================================
        const vacaciones = empleados.map((e) => {
            const misAusAnual = ausenciasAnuales.filter(
                (a) => a.empleadoId === e.id && a.tipo === 'VACACIONES'
            );
            let disfrutadas = 0;
            let pendientesAprobar = 0;

            for (const a of misAusAnual) {
                const ini = new Date(Math.max(new Date(a.fechaInicio).getTime(), startOfYear.getTime()));
                const fin = new Date(Math.min(new Date(a.fechaFin).getTime(), endOfYear.getTime()));
                const days = Math.max(1, Math.ceil((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                if (a.estado === 'APROBADA') disfrutadas += days;
                else if (a.estado === 'PENDIENTE') pendientesAprobar += days;
            }

            const cupoAnual = (e.diasVacaciones || 30) + (e.diasExtras || 0);
            const saldoPendiente = Math.max(0, cupoAnual - disfrutadas);

            return {
                id: e.id,
                empleado: `${e.nombre} ${e.apellidos || ''}`.trim(),
                rol: e.rol,
                diasBase: e.diasVacaciones || 30,
                diasExtrasFestivos: e.diasExtras || 0,
                cupoTotal: cupoAnual,
                diasDisfrutados: disfrutadas,
                diasSolicitadosPendientes: pendientesAprobar,
                saldoPendiente,
                alertaAcumulacion: saldoPendiente >= 15 ? 'ALTA ACUMULACIÓN' : saldoPendiente >= 8 ? 'PLANIFICAR' : 'AL DÍA',
            };
        }).sort((a, b) => b.saldoPendiente - a.saldoPendiente);

        // =========================================================================
        // 8. PRODUCTIVIDAD POR CONDUCTOR (KM, Viajes, Descargas por Jornada)
        // =========================================================================
        const productividad = empleados
            .filter((e) => e.rol === 'CONDUCTOR' || jornadasPeriodo.some((j) => j.empleadoId === e.id && j.usosCamion.length > 0))
            .map((e) => {
                const misJornadas = jornadasPeriodo.filter((j) => j.empleadoId === e.id);
                let kmTotales = 0;
                let viajesTotales = 0;
                let descargasTotales = 0;
                let litrosRepostados = 0;

                for (const j of misJornadas) {
                    for (const u of j.usosCamion) {
                        kmTotales += calcKmTurno(u);
                        viajesTotales += Number(u.viajesCount || 0);
                        descargasTotales += u.descargasCount > 0 ? u.descargasCount : (u.descargas?.length || 0);
                        litrosRepostados += Number(u.litrosRepostados || 0);
                    }
                }

                const jornadasCount = misJornadas.length;
                const kmPorJornada = jornadasCount > 0 ? Math.round((kmTotales / jornadasCount) * 10) / 10 : 0;
                const viajesPorJornada = jornadasCount > 0 ? Math.round((viajesTotales / jornadasCount) * 10) / 10 : 0;
                const descargasPorJornada = jornadasCount > 0 ? Math.round((descargasTotales / jornadasCount) * 10) / 10 : 0;

                // Score objetivo ponderado para incentivos
                const scoreIncentivo = Math.round(kmTotales * 0.05 + descargasTotales * 2.5 + viajesTotales * 3);

                return {
                    id: e.id,
                    conductor: `${e.nombre} ${e.apellidos || ''}`.trim(),
                    jornadasTrabajadas: jornadasCount,
                    kmTotales,
                    kmPorJornada,
                    viajesTotales,
                    viajesPorJornada,
                    descargasTotales,
                    descargasPorJornada,
                    litrosRepostados: Math.round(litrosRepostados),
                    scoreIncentivo,
                };
            })
            .sort((a, b) => b.scoreIncentivo - a.scoreIncentivo);

        // =========================================================================
        // 9. MANTENIMIENTO PREVENTIVO VS CORRECTIVO Y MTTR (Tiempo Medio Reparación)
        // =========================================================================
        const mantenimientoMttr = camiones.map((c) => {
            const mants = mantenimientosPeriodo.filter((m) => m.camionId === c.id);
            const tickets = tareasPeriodo.filter((t) => t.camionId === c.id || t.matricula === c.matricula);

            const preventivos = mants.filter((m) =>
                ['ACEITE', 'ITV', 'REVISION', 'PREVENTIVO', 'FILTROS'].some((k) => m.tipo.toUpperCase().includes(k))
            ).length;
            const correctivos = tickets.length + Math.max(0, mants.length - preventivos);

            let horasResolucionSuma = 0;
            let cerradasCount = 0;
            let inmovilizadoHoras = 0;

            for (const t of tickets) {
                if (t.extensionTaller?.tiempoInmovilizacionHoras) {
                    inmovilizadoHoras += Number(t.extensionTaller.tiempoInmovilizacionHoras);
                }
                if (t.fechaCierre && t.fechaInicio) {
                    const diffH = Math.max(
                        0.5,
                        (new Date(t.fechaCierre).getTime() - new Date(t.fechaInicio).getTime()) / (1000 * 60 * 60)
                    );
                    horasResolucionSuma += diffH;
                    cerradasCount++;
                }
            }

            const mttrHoras = cerradasCount > 0 ? Math.round((horasResolucionSuma / cerradasCount) * 10) / 10 : 0;
            const totalIntervenciones = preventivos + correctivos;
            const ratioPreventivoPct = totalIntervenciones > 0
                ? Math.round((preventivos / totalIntervenciones) * 100)
                : 100;

            return {
                id: c.id,
                matricula: c.matricula,
                modelo: `${c.marca || ''} ${c.modelo || ''}`.trim() || 'Cisterna',
                preventivos,
                correctivos,
                totalIntervenciones,
                ratioPreventivoPct,
                ticketsCerrados: cerradasCount,
                mttrHoras,
                inmovilizadoHoras: Math.round(inmovilizadoHoras * 10) / 10,
            };
        }).sort((a, b) => b.totalIntervenciones - a.totalIntervenciones);

        return NextResponse.json({
            periodo: {
                desde: startDate.toISOString().split('T')[0],
                hasta: endDate.toISOString().split('T')[0],
                year,
                month,
            },
            resumenGlobal: {
                vencimientosCriticos: vencimientos.filter((v) => v.diasRestantes <= 30).length,
                costeFlotaTotal: Math.round(costeKm.reduce((a, b) => a + b.costeTotal, 0)),
                horasExtraTotales: Math.round(horasExtra.reduce((a, b) => a + b.horasExtraPeriodo, 0) * 10) / 10,
                infraccionesTacografo: tacografoInfracciones.reduce((a, b) => a + b.totalInfracciones, 0),
                vacacionesPendientesTotal: vacaciones.reduce((a, b) => a + b.saldoPendiente, 0),
                kmTotalesPeriodo: productividad.reduce((a, b) => a + b.kmTotales, 0),
            },
            reports: {
                vencimientos,
                costeKm,
                consumo,
                horasExtra,
                tacografoInfracciones,
                absentismo,
                vacaciones,
                productividad,
                mantenimientoMttr,
            },
        });
    } catch (error: any) {
        console.error('Error en /api/admin/informes/centro:', error);
        return NextResponse.json(
            { error: 'Error generando el centro de informes', details: error?.message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['ADMIN', 'OFICINA'].includes(String(session.rol))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { tipoEnvio, destinatarioEmail, year, month, resumenDatos } = body;

        if (!destinatarioEmail || !String(destinatarioEmail).includes('@')) {
            return NextResponse.json({ error: 'Introduce un email de destino válido' }, { status: 400 });
        }

        const targetYear = Number(year) || new Date().getFullYear();
        const targetMonth = Number(month) || (new Date().getMonth() + 1);

        // Registrar el envío en la base de datos (EnvioGestoria + Auditoria)
        if (tipoEnvio === 'MENSUAL_GESTORIA') {
            await prisma.envioGestoria.create({
                data: {
                    year: targetYear,
                    month: targetMonth,
                    usuarioId: Number(session.id),
                    urlPdfConsolidado: `mailto:${destinatarioEmail}?subject=Informe_Mensual_${targetYear}_${targetMonth}`,
                    status: 'ENVIADO_EMAIL',
                },
            });
        }

        await prisma.auditoria.create({
            data: {
                usuarioId: Number(session.id),
                accion: 'ENVIO_INFORME_EMAIL',
                entidad: 'CentroInformes',
                entidadId: targetMonth,
                detalles: JSON.stringify({
                    tipoEnvio,
                    destinatarioEmail,
                    periodo: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
                    resumenDatos,
                }),
            },
        });

        // Si existe RESEND_API_KEY configurada en variables de entorno, enviamos correo transaccional real
        let providerStatus = 'REGISTRADO_Y_LISTO';
        if (process.env.RESEND_API_KEY) {
            const subject = tipoEnvio === 'MENSUAL_GESTORIA'
                ? `[SEL Trans] Cierre Mensual de Nóminas y Variables (${targetMonth}/${targetYear})`
                : `[SEL Trans] Resumen Ejecutivo Semanal de Dirección (${targetMonth}/${targetYear})`;

            const htmlBody = `
                <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #0f172a; margin-top: 0;">${subject}</h2>
                    <p style="color: #475569;">Generado automáticamente desde el Centro de Informes de SEL Control Horario.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><b>KM Totales Período</b></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${resumenDatos?.kmTotalesPeriodo || 0} km</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><b>Horas Extra Computadas</b></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${resumenDatos?.horasExtraTotales || 0} h</td></tr>
                        <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #e2e8f0;"><b>Coste Operativo Flota</b></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${resumenDatos?.costeFlotaTotal || 0} €</td></tr>
                        <tr><td style="padding: 10px; border: 1px solid #e2e8f0;"><b>Vencimientos Críticos (≤30d)</b></td><td style="padding: 10px; border: 1px solid #e2e8f0;">${resumenDatos?.vencimientosCriticos || 0}</td></tr>
                    </table>
                    <p style="font-size: 12px; color: #64748b;">Enviado a: ${destinatarioEmail}</p>
                </div>
            `;

            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'SEL Control Horario <onboarding@resend.dev>',
                    to: [destinatarioEmail],
                    subject,
                    html: htmlBody,
                }),
            });

            if (resendRes.ok) {
                providerStatus = 'ENVIADO_SMTP_RESEND';
            }
        }

        return NextResponse.json({
            ok: true,
            providerStatus,
            destinatarioEmail,
            tipoEnvio,
            mensaje: `Informe ${tipoEnvio === 'MENSUAL_GESTORIA' ? 'Mensual de Gestoría' : 'Ejecutivo de Dirección'} registrado y preparado para ${destinatarioEmail}.`,
        });
    } catch (error: any) {
        console.error('Error enviando informe por email:', error);
        return NextResponse.json({ error: 'No se pudo procesar el envío por email' }, { status: 500 });
    }
}
