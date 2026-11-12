import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, parseISO, addMonths } from 'date-fns';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const startDate = month === 0
            ? new Date(year, 0, 1)
            : new Date(year, month - 1, 1);

        const endDate = month === 0
            ? new Date(year, 11, 31, 23, 59, 59)
            : endOfMonth(startDate);

        // Fetch Jornadas within month
        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                fecha: { gte: startDate, lte: endDate }
            },
            include: {
                empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } },
                usosCamion: {
                    select: {
                        camionId: true,
                        camion: { select: { id: true, matricula: true, modelo: true, marca: true } },
                        kmInicial: true,
                        kmFinal: true,
                        kmRecorridos: true,
                        horaFin: true,
                        litrosRepostados: true,
                        descargasCount: true,
                        viajesCount: true,
                        mantenimientos: {
                            select: { aceite: true, litrosAceite: true, hidraulico: true, refrigerante: true, lavado: true }
                        }
                    }
                }
            }
        });

        // Fetch Absences overlapping the month
        // An absence counts if it starts or ends within the month, or spans over it.
        const ausencias = await prisma.ausencia.findMany({
            where: {
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ],
                estado: 'APROBADA'
            }
        });

        // -----------------------------
        // CALCULATIONS
        // -----------------------------

        let totalHoras = 0;
        let totalKm = 0;
        let totalLitros = 0;
        let totalDescargas = 0;
        let totalViajes = 0;
        let countJornadas = jornadas.length;
        let countUsosCamion = 0; // Days trucks were used
        let countRepostajes = 0; // Days refueling happened

        const employeeStats: Record<number, any> = {};
        const roleStats: Record<string, any> = {};
        const truckStats: Record<number, any> = {};

        jornadas.forEach(jor => {
            const empId = jor.empleadoId;
            const role = jor.empleado.rol || 'SIN_ROL';

            // Init Employee Stats
            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    empleadoId: empId,
                    empleado: `${jor.empleado.nombre} ${jor.empleado.apellidos || ''}`,
                    rol: role,
                    horas: 0,
                    km: 0,
                    litros: 0,
                    viajes: 0,
                    descargas: 0,
                    diasTrabajados: 0,
                    _datesSet: new Set<string>()
                };
            }

            // Init Role Stats
            if (!roleStats[role]) {
                roleStats[role] = {
                    rol: role,
                    horas: 0,
                    km: 0,
                    litros: 0,
                    viajes: 0,
                    descargas: 0,
                    diasTrabajados: 0,
                    countJornadas: 0
                };
            }

            let horas = jor.totalHoras;
            const isAutoClosed = typeof jor.observaciones === 'string' && jor.observaciones.includes('Cierre automático');
            if (horas === null || horas > 16 || isAutoClosed) {
                const startMs = new Date(jor.horaEntrada).getTime();
                const maxReasonableMs = 16 * 60 * 60 * 1000;
                let maxUsoFinMs: number | null = null;
                for (const u of jor.usosCamion) {
                    if (u.horaFin) {
                        const finMs = new Date(u.horaFin).getTime();
                        if (finMs > startMs && (finMs - startMs) <= maxReasonableMs) {
                            if (!maxUsoFinMs || finMs > maxUsoFinMs) maxUsoFinMs = finMs;
                        }
                    }
                }
                if (maxUsoFinMs) {
                    horas = (maxUsoFinMs - startMs) / (1000 * 60 * 60);
                } else if (jor.horaSalida && !isAutoClosed) {
                    const diffMs = new Date(jor.horaSalida).getTime() - startMs;
                    horas = (diffMs >= 0 && diffMs <= maxReasonableMs) ? (diffMs / (1000 * 60 * 60)) : 8;
                } else if (typeof jor.totalHoras === 'number' && jor.totalHoras > 0 && jor.totalHoras <= 16) {
                    horas = jor.totalHoras;
                } else {
                    const nowMs = Date.now();
                    horas = (!jor.horaSalida && (nowMs - startMs) <= maxReasonableMs) ? Math.max(0, (nowMs - startMs) / (1000 * 60 * 60)) : 8;
                }
            }
            totalHoras += horas;

            const dayKey = new Date(jor.fecha).toISOString().slice(0, 10);
            const isNewDayForEmp = !employeeStats[empId]._datesSet.has(dayKey);
            if (isNewDayForEmp) {
                employeeStats[empId]._datesSet.add(dayKey);
                employeeStats[empId].diasTrabajados += 1;
            }

            // Employee Accumulation
            employeeStats[empId].horas += horas;

            // Role Accumulation
            roleStats[role].horas += horas;
            roleStats[role].countJornadas += 1;
            if (isNewDayForEmp) {
                roleStats[role].diasTrabajados += 1;
            }

            let jornadaKm = 0;
            let jornadaLitros = 0;
            let jornadaViajes = 0;
            let jornadaDescargas = 0;
            let hasTruckUsage = false;
            let hasRefuel = false;

            jor.usosCamion.forEach(uso => {
                const km = (typeof uso.kmRecorridos === 'number' && uso.kmRecorridos > 0)
                    ? uso.kmRecorridos
                    : ((typeof uso.kmFinal === 'number' && typeof uso.kmInicial === 'number' && uso.kmFinal > uso.kmInicial) ? (uso.kmFinal - uso.kmInicial) : 0);
                const l = uso.litrosRepostados || 0;
                jornadaKm += km;
                jornadaLitros += l;
                jornadaViajes += (uso.viajesCount || 0);
                jornadaDescargas += (uso.descargasCount || 0);

                if (km > 0) hasTruckUsage = true;
                if (l > 0) hasRefuel = true;

                // Aggregate Truck Stats
                const cId = uso.camionId;
                if (cId) {
                    if (!truckStats[cId]) {
                        truckStats[cId] = {
                            camionId: cId,
                            matricula: uso.camion?.matricula || `ID-${cId}`,
                            modelo: [uso.camion?.marca, uso.camion?.modelo].filter(Boolean).join(' ') || 'Vehículo Flota',
                            km: 0,
                            litros: 0,
                            viajes: 0,
                            descargas: 0,
                            salidas: 0,
                            aceiteCount: 0,
                            litrosAceite: 0,
                            hidraulicoCount: 0,
                            refrigeranteCount: 0,
                            lavadoCount: 0
                        };
                    }
                    truckStats[cId].km += km;
                    truckStats[cId].litros += l;
                    truckStats[cId].viajes += (uso.viajesCount || 0);
                    truckStats[cId].descargas += (uso.descargasCount || 0);
                    truckStats[cId].salidas += 1;

                    if (Array.isArray(uso.mantenimientos)) {
                        uso.mantenimientos.forEach((m: any) => {
                            if (m.aceite) {
                                truckStats[cId].aceiteCount += 1;
                                truckStats[cId].litrosAceite += (m.litrosAceite || 0);
                            }
                            if (m.hidraulico) truckStats[cId].hidraulicoCount += 1;
                            if (m.refrigerante) truckStats[cId].refrigeranteCount += 1;
                            if (m.lavado) truckStats[cId].lavadoCount += 1;
                        });
                    }
                }
            });

            totalKm += jornadaKm;
            totalLitros += jornadaLitros;
            totalViajes += jornadaViajes;
            totalDescargas += jornadaDescargas;

            if (hasTruckUsage) countUsosCamion++;
            if (hasRefuel) countRepostajes++;

            // Update Employee
            employeeStats[empId].km += jornadaKm;
            employeeStats[empId].litros += jornadaLitros;
            employeeStats[empId].viajes += jornadaViajes;
            employeeStats[empId].descargas += jornadaDescargas;

            // Update Role
            roleStats[role].km += jornadaKm;
            roleStats[role].litros += jornadaLitros;
            roleStats[role].viajes += jornadaViajes;
            roleStats[role].descargas += jornadaDescargas;
        });

        // --- AVERAGES CALCULATIONS ---

        // 1. Global Averages
        const averages = {
            horasPorJornada: countJornadas > 0 ? (totalHoras / countJornadas) : 0,
            kmPorJornada: countJornadas > 0 ? (totalKm / countJornadas) : 0,
            kmPorSalida: countUsosCamion > 0 ? (totalKm / countUsosCamion) : 0,
            litrosPorJornada: countJornadas > 0 ? (totalLitros / countJornadas) : 0,
            consumoMedio: totalKm > 0 ? ((totalLitros / totalKm) * 100) : 0,
            descargasPorDia: countJornadas > 0 ? (totalDescargas / countJornadas) : 0,
            viajesPorDia: countJornadas > 0 ? (totalViajes / countJornadas) : 0,
        };

        // 2. Per-Role Averages
        const averagesByRole = Object.values(roleStats).map((r: any) => ({
            rol: r.rol,
            horasPorDia: r.countJornadas > 0 ? (r.horas / r.countJornadas) : 0,
            kmPorDia: r.countJornadas > 0 ? (r.km / r.countJornadas) : 0,
            consumoMedio: r.km > 0 ? ((r.litros / r.km) * 100) : 0,
            totalHoras: r.horas,
            totalKm: r.km
        }));

        // 3. Enrich Employee Stats with Averages
        const ranking = Object.values(employeeStats).map(({ _datesSet, ...e }: any) => ({
            ...e,
            mediaHorasDia: e.diasTrabajados > 0 ? (e.horas / e.diasTrabajados) : 0,
            mediaKmDia: e.diasTrabajados > 0 ? (e.km / e.diasTrabajados) : 0,
            consumoMedio: e.km > 0 ? ((e.litros / e.km) * 100) : 0
        })).sort((a: any, b: any) => {
            if (a.rol < b.rol) return -1;
            if (a.rol > b.rol) return 1;
            return a.empleado.localeCompare(b.empleado);
        });

        // 4. Enrich Truck Stats with Consumption
        const camionRanking = Object.values(truckStats).map((c: any) => ({
            ...c,
            consumoMedio: c.km > 0 ? ((c.litros / c.km) * 100) : 0
        })).sort((a: any, b: any) => b.km - a.km);

        return NextResponse.json({
            meta: { year, month },
            totals: {
                totalHoras,
                totalKm,
                totalLitros,
                totalDescargas,
                totalViajes,
                countJornadas,
                countAusencias: ausencias.length
            },
            averages,
            averagesByRole,
            ranking,
            camionRanking
        });

    } catch (error) {
        console.error('Error fetching monthly report:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
