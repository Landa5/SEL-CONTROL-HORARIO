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

        // 2. Fetch Tasks unrelated to specific jornadas (just in case)
        // ... (Already covered by fetching tareasAsignadas in empleado)

        // 3. Process Data by Role
        const report = {
            summary: {
                totalEmpleados: 0,
                conductoresRuta: 0,
                mecanicoTaller: 0, // Mecánicos sin conducción
                mecanicoRuta: 0,   // Mecánicos con conducción
                kmTotales: 0,
                descargasTotales: 0,
                litrosTotales: 0,
                horasTotales: 0,
                utilizacionOperativa: 0 // % of time in productive tasks/driving vs total time
            },
            conductores: [] as any[],
            mecanicos: [] as any[],
            oficina: [] as any[],
            empleados: [] as any[],
            jornadaPartida: [] as any[], // Warnings about breaks
            riesgos: [] as any[]
        };

        const empleadosProcesados = new Set<number>();

        jornadas.forEach(jor => {
            const emp = jor.empleado;
            if (empleadosProcesados.has(emp.id)) return; // Avoid duplicates if multiple jornadas (rare but possible)
            empleadosProcesados.add(emp.id);

            report.summary.totalEmpleados++;

            // Calculate Times
            const start = new Date(jor.horaEntrada);
            const end = jor.horaSalida ? new Date(jor.horaSalida) : new Date(); // If active, calc until now
            const totalMinutes = differenceInMinutes(end, start);
            report.summary.horasTotales += totalMinutes / 60;

            // Analyze Breaks (Jornada Partida)
            // Simplified: If total duration > 9h
            if (totalMinutes > 9 * 60) {
                report.jornadaPartida.push({
                    nombre: emp.nombre,
                    rol: emp.rol,
                    horas: (totalMinutes / 60).toFixed(2),
                    tipo: 'Jornada Extendida (>9h)'
                });
            }

            // Analyze Role Data
            const usos = jor.usosCamion || [];
            let drivingMinutes = 0;
            let km = 0;
            let descargas = 0;
            let litros = 0;
            let risk = null;

            usos.forEach(uso => {
                const uStart = new Date(uso.horaInicio);
                const uEnd = uso.horaFin ? new Date(uso.horaFin) : new Date();
                drivingMinutes += differenceInMinutes(uEnd, uStart);

                let k = uso.kmRecorridos || 0;
                if (k === 0 && uso.kmFinal && uso.kmInicial) k = uso.kmFinal - uso.kmInicial;
                if (k < 0) k = 0;
                km += k;

                descargas += uso.descargasCount || uso.descargas.length || 0;
                litros += uso.litrosRepostados || 0;

                // Driver Risk: Maintenance Pending
                if (uso.camion && uso.camion.mantenimientosPlanificados.length > 0) {
                    risk = `Conduciendo camión ${uso.camion.matricula} con mantenimiento pendiente`;
                    report.riesgos.push({
                        empleado: emp.nombre,
                        rol: emp.rol,
                        mensaje: risk,
                        severidad: 'ALTA'
                    });
                }
            });

            report.summary.kmTotales += km;
            report.summary.descargasTotales += descargas;
            report.summary.litrosTotales += litros;

            const stats = {
                id: emp.id,
                nombre: emp.nombre,
                horaEntrada: format(start, 'HH:mm'),
                horaSalida: jor.horaSalida ? format(new Date(jor.horaSalida), 'HH:mm') : 'En curso',
                horas: (totalMinutes / 60).toFixed(2),
                tareas: emp.tareasAsignadas.length,
                detalleTareas: emp.tareasAsignadas.map((t: any) => t.titulo).join(', ')
            };

            if (emp.rol === 'CONDUCTOR') {
                report.summary.conductoresRuta++;
                const kmh = drivingMinutes > 0 ? (km / (drivingMinutes / 60)).toFixed(1) : 0;
                // Infrautilized?
                const utilization = totalMinutes > 0 ? (drivingMinutes / totalMinutes) * 100 : 0;

                report.conductores.push({
                    ...stats,
                    km,
                    descargas,
                    conduccionHoras: (drivingMinutes / 60).toFixed(2),
                    kmh,
                    utilizacion: utilization.toFixed(0) + '%'
                });

                if (km === 0 && drivingMinutes > 60) {
                    report.riesgos.push({
                        empleado: emp.nombre,
                        rol: 'CONDUCTOR',
                        mensaje: 'Más de 1h de conducción sin KM productivos (posible error o espera)',
                        severidad: 'MEDIA'
                    });
                }

            } else if (emp.rol === 'MECANICO') {
                const driving = drivingMinutes > 0;
                if (driving) report.summary.mecanicoRuta++;
                else report.summary.mecanicoTaller++;

                report.mecanicos.push({
                    ...stats,
                    actividad: driving ? 'Ruta / Prueba' : 'Taller',
                    km,
                    conduccionHoras: (drivingMinutes / 60).toFixed(2),
                    tallerHoras: ((totalMinutes - drivingMinutes) / 60).toFixed(2)
                });

            } else if (emp.rol === 'OFICINA' || emp.rol === 'ADMIN') {
                report.oficina.push({
                    ...stats,
                    nivelSoporte: 'N/A' // Placeholder logic
                });
            } else {
                report.empleados.push(stats);
            }
        });

        // Global Indicators
        if (report.summary.horasTotales > 0) {
            // Basic proxy for utilization: (Driving Time for drivers + Task time for mechanics/office) / Total Time
            // Simplified for now based on available data
            report.summary.utilizacionOperativa = 85; // Mock for now, requires deeper specific task tracking
        }

        return NextResponse.json(report);

    } catch (error) {
        console.error("Error generating daily report:", error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
