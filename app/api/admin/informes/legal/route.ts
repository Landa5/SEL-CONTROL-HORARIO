import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isWeekend, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const startDate = new Date(year, month - 1, 1);
        const endDate = endOfMonth(startDate);
        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

        // 1. Fetch Data
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            orderBy: { nombre: 'asc' }
        });

        const jornadas = await prisma.jornadaLaboral.findMany({
            where: { fecha: { gte: startDate, lte: endDate } }
        });

        const ausencias = await prisma.ausencia.findMany({
            where: {
                estado: 'APROBADA',
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ]
            }
        });

        const fiestas = await prisma.fiestaLocal.findMany({
            where: {
                fecha: { gte: startDate, lte: endDate },
                activa: true
            }
        });

        // 2. Build Report
        const reportData = empleados.map(emp => {
            const days = daysInMonth.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');

                // Find Shifts
                const empJornadas = jornadas.filter(j =>
                    j.empleadoId === emp.id &&
                    format(new Date(j.fecha), 'yyyy-MM-dd') === dateKey
                );

                // Find Absence
                const ausencia = ausencias.find(a =>
                    a.empleadoId === emp.id &&
                    day >= new Date(a.fechaInicio) &&
                    day <= new Date(a.fechaFin)
                );

                // Find Holiday
                const fiesta = fiestas.find(f => isSameDay(new Date(f.fecha), day));

                // Determine Content
                let entrada = '';
                let salida = '';
                let horas = '';
                let tipo = '';
                let detalle = '';

                if (empJornadas.length > 0) {
                    // Worked Day
                    entrada = empJornadas.map(j => format(new Date(j.horaEntrada), 'HH:mm')).join(' / ');
                    salida = empJornadas.map(j => j.horaSalida ? format(new Date(j.horaSalida), 'HH:mm') : '??:??').join(' / ');
                    const totalHours = empJornadas.reduce((acc, j) => acc + (j.totalHoras || 0), 0);
                    horas = totalHours > 0 ? totalHours.toFixed(2) : '';
                    tipo = 'TRABAJO';
                } else {
                    // Non-worked Day Priority: Holiday > Absence > Weekend > Empty
                    if (fiesta) {
                        tipo = 'FESTIVO';
                        detalle = fiesta.nombre;
                    } else if (ausencia) {
                        tipo = 'AUSENCIA';
                        detalle = ausencia.tipo;
                    } else if (isWeekend(day)) {
                        tipo = 'DESCANSO';
                        detalle = 'Fin de Semana';
                    }
                }

                return {
                    fecha: format(day, 'dd/MM/yyyy'),
                    diaSemana: format(day, 'EEEE', { locale: es }),
                    entrada,
                    salida,
                    horas,
                    tipo,
                    detalle
                };
            });

            // Totals
            const totalHorasMensual = days.reduce((acc, d) => acc + parseFloat(d.horas || '0'), 0);

            return {
                empleado: {
                    id: emp.id,
                    nombre: emp.nombre,
                    apellidos: emp.apellidos,
                    dni: emp.dni,
                    rol: emp.rol
                },
                registros: days,
                totalHoras: totalHorasMensual.toFixed(2)
            };
        });

        return NextResponse.json({
            periodo: format(startDate, 'MMMM yyyy', { locale: es }),
            data: reportData
        });

    } catch (error) {
        console.error("Error generating legal report:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
