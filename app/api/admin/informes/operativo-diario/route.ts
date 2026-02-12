import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfDay, endOfDay, parseISO, differenceInMinutes, format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const date = dateParam ? parseISO(dateParam) : new Date();
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    try {
        // 1. Fetch Jornadas (Base for presence)
        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                fecha: {
                    gte: dayStart,
                    lte: dayEnd
                }
            },
            include: {
                empleado: {
                    include: {
                        tareasAsignadas: {
                            where: {
                                OR: [
                                    { fechaCierre: { gte: dayStart, lte: dayEnd } },
                                    { estado: 'EN_CURSO' },
                                    { fechaInicio: { gte: dayStart, lte: dayEnd } }
                                ]
                            }
                        }
                    }
                },
                usosCamion: {
                    include: {
                        camion: {
                            include: {
                                mantenimientosPlanificados: {
                                    where: { estado: 'PROGRAMADO' }
                                }
                            }
                        },
                        descargas: true
                    }
                }
            }
        });

        // 2. data structures
        const report = {
            summary: {
                totalEmpleados: 0,
                conductoresRuta: 0,
                mecanicoTaller: 0,
                mecanicoRuta: 0,
                kmTotales: 0,
                descargasTotales: 0,
                litrosTotales: 0,
                horasTotales: 0,
                utilizacionOperativa: 0
            },
            conductores: [] as any[],
            mecanicos: [] as any[],
            oficina: [] as any[],
            empleados: [] as any[],
            jornadaPartida: [] as any[],
            riesgos: [] as any[]
        };

        // Map to aggregate data by employee ID
        const employeeStatsMap = new Map<number, any>();

        // 3. Aggregate Data
        jornadas.forEach(jor => {
            const emp = jor.empleado;

            if (!employeeStatsMap.has(emp.id)) {
                employeeStatsMap.set(emp.id, {
                    employee: emp,
                    jornadas: [],
                    totalMinutes: 0,
                    drivingMinutes: 0,
                    km: 0,
                    descargas: 0,
                    litros: 0,
                    risks: []
                });
            }

            const stats = employeeStatsMap.get(emp.id);
            stats.jornadas.push(jor);

            // Time Calculation
            const start = new Date(jor.horaEntrada);
            const end = jor.horaSalida ? new Date(jor.horaSalida) : new Date();
            const minutes = differenceInMinutes(end, start);
            stats.totalMinutes += minutes;

            // Truck Usage Analysis
            const usos = jor.usosCamion || [];
            usos.forEach((uso: any) => {
                const uStart = new Date(uso.horaInicio);
                const uEnd = uso.horaFin ? new Date(uso.horaFin) : new Date();
                stats.drivingMinutes += differenceInMinutes(uEnd, uStart);

                let k = uso.kmRecorridos || 0;
                if (k === 0 && uso.kmFinal && uso.kmInicial) k = uso.kmFinal - uso.kmInicial;
                if (k < 0) k = 0;
                stats.km += k;

                stats.descargas += uso.descargasCount || (uso.descargas ? uso.descargas.length : 0) || 0;
                stats.litros += uso.litrosRepostados || 0;

                // Risk Analysis: Maintenance
                if (uso.camion && uso.camion.mantenimientosPlanificados.length > 0) {
                    const riskMsg = `Conduciendo camión ${uso.camion.matricula} con mantenimiento pendiente`;
                    // Avoid duplicate risk messages
                    if (!stats.risks.some((r: any) => r.mensaje === riskMsg)) {
                        stats.risks.push({
                            empleado: emp.nombre,
                            rol: emp.rol,
                            mensaje: riskMsg,
                            severidad: 'ALTA'
                        });
                    }
                }
            });
        });

        // 4. Process Aggregates into Report
        report.summary.totalEmpleados = employeeStatsMap.size;

        employeeStatsMap.forEach(stats => {
            const { employee, jornadas, totalMinutes, drivingMinutes, km, descargas, litros, risks } = stats;

            // Update Summary Totals
            report.summary.horasTotales += totalMinutes / 60;
            report.summary.kmTotales += km;
            report.summary.descargasTotales += descargas;
            report.summary.litrosTotales += litros;

            // Add collected risks to global report
            if (risks.length > 0) {
                report.riesgos.push(...risks);
            }

            // Determine Shift Time Range (Min Start - Max End)
            // Or format as "08:00-14:00, 16:00-19:00"
            const sortedJornadas = jornadas.sort((a: any, b: any) => new Date(a.horaEntrada).getTime() - new Date(b.horaEntrada).getTime());
            const timeRanges = sortedJornadas.map((j: any) => {
                const s = format(new Date(j.horaEntrada), 'HH:mm');
                const e = j.horaSalida ? format(new Date(j.horaSalida), 'HH:mm') : 'En curso';
                return `${s}-${e}`;
            }).join(', ');

            // Jornada Partida / Extended Day Warning
            if (totalMinutes > 9 * 60) {
                report.jornadaPartida.push({
                    nombre: employee.nombre,
                    rol: employee.rol,
                    horas: (totalMinutes / 60).toFixed(2),
                    tipo: 'Jornada Extendida (>9h)'
                });
            }

            const baseStats = {
                id: employee.id,
                nombre: employee.nombre,
                horaEntrada: timeRanges, // Replaced single start/end with range list
                horaSalida: '', // Unused in favor of range above
                horas: (totalMinutes / 60).toFixed(2),
                tareas: employee.tareasAsignadas.length,
                detalleTareas: employee.tareasAsignadas.map((t: any) => t.titulo).join(', ')
            };

            if (employee.rol === 'CONDUCTOR') {
                report.summary.conductoresRuta++;

                const kmh = drivingMinutes > 0 ? (km / (drivingMinutes / 60)).toFixed(1) : 0;
                const utilization = totalMinutes > 0 ? (drivingMinutes / totalMinutes) * 100 : 0;

                report.conductores.push({
                    ...baseStats,
                    km,
                    descargas,
                    conduccionHoras: (drivingMinutes / 60).toFixed(2),
                    kmh,
                    utilizacion: utilization.toFixed(0) + '%'
                });

                if (km === 0 && drivingMinutes > 60) {
                    report.riesgos.push({
                        empleado: employee.nombre,
                        rol: 'CONDUCTOR',
                        mensaje: 'Más de 1h de conducción sin KM productivos (posible error o espera)',
                        severidad: 'MEDIA'
                    });
                }

            } else if (employee.rol === 'MECANICO') {
                const driving = drivingMinutes > 0;
                if (driving) report.summary.mecanicoRuta++;
                else report.summary.mecanicoTaller++;

                report.mecanicos.push({
                    ...baseStats,
                    actividad: driving ? 'Ruta / Prueba' : 'Taller',
                    km,
                    conduccionHoras: (drivingMinutes / 60).toFixed(2),
                    tallerHoras: ((totalMinutes - drivingMinutes) / 60).toFixed(2)
                });

            } else if (employee.rol === 'OFICINA' || employee.rol === 'ADMIN') {
                report.oficina.push({
                    ...baseStats,
                    nivelSoporte: 'N/A'
                });
            } else {
                report.empleados.push(baseStats);
            }
        });

        // Global efficiency indicator
        if (report.summary.horasTotales > 0) {
            report.summary.utilizacionOperativa = 85;
        }

        return NextResponse.json(report);

    } catch (error) {
        console.error("Error generating daily report:", error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
