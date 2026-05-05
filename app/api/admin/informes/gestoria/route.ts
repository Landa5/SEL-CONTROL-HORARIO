import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { endOfMonth, isSameDay, isWeekend, eachDayOfInterval, differenceInMinutes, format } from 'date-fns';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const startDate = new Date(year, month - 1, 1);
        const endDate = endOfMonth(startDate);

        // Fetch Concepts and Tariffs
        const conceptos = await prisma.conceptoNomina.findMany({
            where: { active: true },
            include: {
                tarifas: {
                    where: { activo: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        const getTarifa = (code: string, empId: number, role: string) => {
            const concepto = conceptos.find(c => c.codigo === code);
            if (!concepto) return 0;
            const empTarifa = concepto.tarifas.find(t => t.empleadoId === empId);
            if (empTarifa) return empTarifa.valor;
            const roleTarifa = concepto.tarifas.find(t => t.rol === role && !t.empleadoId);
            if (roleTarifa) return roleTarifa.valor;
            const globalTarifa = concepto.tarifas.find(t => !t.rol && !t.empleadoId);
            if (globalTarifa) return globalTarifa.valor;
            return 0;
        };

        // Fetch Employees
        const empleados = await prisma.empleado.findMany({
            where: { activo: true },
            select: { id: true, nombre: true, apellidos: true, dni: true, rol: true }
        });

        // Fetch Jornadas within month
        const jornadas = await prisma.jornadaLaboral.findMany({
            where: {
                fecha: { gte: startDate, lte: endDate }
            },
            include: {
                usosCamion: { select: { kmRecorridos: true, litrosRepostados: true, descargasCount: true, viajesCount: true } },
            }
        });

        // Fetch Holidays
        const allHolidays = await prisma.fiestaLocal.findMany({
            where: { activa: true }
        });

        const isHolidayDay = (day: Date) => {
            const dayStr = format(day, 'MM-dd');
            return allHolidays.some(h => {
                const hDate = new Date(h.fecha);
                const hStr = format(hDate, 'MM-dd');
                if (h.esAnual) {
                    return hStr === dayStr;
                }
                return format(hDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
            });
        };

        // Fetch Absences (Bajas) > 3 days
        const ausencias = await prisma.ausencia.findMany({
            where: {
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ],
                estado: 'APROBADA',
            }
        });

        // Fetch saved NominaMes for all employees this month
        const nominasSaved = await prisma.nominaMes.findMany({
            where: { year, month },
            include: { lineas: true }
        });

        // Helper to get saved nomina for an employee
        const getSavedNomina = (empId: number) => nominasSaved.find(n => n.empleadoId === empId);

        // -----------------------------
        // PROCESSING DATA PER EMPLOYEE
        // -----------------------------
        const reportData = empleados.map(emp => {
            const empJornadas = jornadas.filter(j => j.empleadoId === emp.id);

            let totalKm = 0;
            let totalDescargas = 0;
            let totalViajes = 0;
            let diasTrabajados = 0;
            let totalHoras = 0;
            let horasExtrasFestivos = 0;

            empJornadas.forEach(jor => {
                jor.usosCamion.forEach(uso => {
                    totalKm += (uso.kmRecorridos || 0);
                    totalDescargas += (uso.descargasCount || 0);
                    totalViajes += (uso.viajesCount || 0);
                });
                diasTrabajados++;
                totalHoras += (jor.totalHoras || 0);

                // Check if this day is a holiday or weekend (festivo worked)
                const jorDate = new Date(jor.fecha);
                if (isHolidayDay(jorDate) || isWeekend(jorDate)) {
                    // Count hours worked on festivo
                    if (jor.horaEntrada && jor.horaSalida) {
                        const mins = differenceInMinutes(new Date(jor.horaSalida), new Date(jor.horaEntrada));
                        horasExtrasFestivos += Math.max(0, mins / 60);
                    } else {
                        horasExtrasFestivos += (jor.totalHoras || 0);
                    }
                }
            });

            // Check if there's a saved NominaMes with edited data
            const savedNomina = getSavedNomina(emp.id);
            let totalDietas = 0;
            let totalProductividad = 0;
            let totalIncentivos = 0;

            if (savedNomina && savedNomina.lineas.length > 0) {
                // Use saved nomina data (edited by admin)
                savedNomina.lineas.forEach(linea => {
                    if (linea.conceptoCodigo === 'DIETAS' || linea.conceptoCodigo === 'DIETA_NACION') {
                        totalDietas += linea.importe;
                    } else if (linea.conceptoCodigo === 'PRODUCTIVIDAD' || linea.conceptoCodigo === 'PRODUCTIVIDAD_FIJA') {
                        totalProductividad += linea.importe;
                    } else if (linea.conceptoCodigo === 'INCENTIVOS' || linea.conceptoCodigo === 'BONUS_SEGURIDAD' || linea.conceptoCodigo === 'BONUS_PUNTUALIDAD' || linea.conceptoCodigo === 'BONUS_CONSUMO') {
                        totalIncentivos += linea.importe;
                    }
                });
                // If nomina has KM data, use it
                const kmLine = savedNomina.lineas.find(l => l.conceptoCodigo === 'PRECIO_KM');
                if (kmLine) totalKm = kmLine.cantidad;
                // If nomina has horas extra, use it
                const heLine = savedNomina.lineas.find(l => l.conceptoCodigo === 'HORAS_EXTRA');
                if (heLine && heLine.importe > 0) horasExtrasFestivos = heLine.cantidad;
            } else {
                // Fallback: Calculate from tariffs
                const dietasRate = getTarifa('DIETAS', emp.id, emp.rol);
                totalDietas = diasTrabajados * dietasRate;
                totalProductividad = getTarifa('PRODUCTIVIDAD_FIJA', emp.id, emp.rol);
                totalIncentivos = getTarifa('INCENTIVOS', emp.id, emp.rol);
            }

            // BAJAS > 3 DAYS
            const empAusencias = ausencias.filter(a => a.empleadoId === emp.id && (a.tipo === 'BAJA' || a.tipo === 'BAJA_MEDICA'));
            let diasBaja = 0;
            let esBajaLarga = false;

            empAusencias.forEach(baja => {
                const totalDuration = Math.ceil((Math.abs((baja.fechaFin || endDate).getTime() - baja.fechaInicio.getTime())) / (1000 * 3600 * 24)) + 1;
                if (totalDuration > 3) {
                    const start = baja.fechaInicio < startDate ? startDate : baja.fechaInicio;
                    const end = baja.fechaFin && baja.fechaFin < endDate ? baja.fechaFin : endDate;
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    diasBaja += Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    esBajaLarga = true;
                }
            });

            return {
                id: emp.id,
                nombre: emp.nombre,
                apellidos: emp.apellidos || '',
                dni: emp.dni || '',
                rol: emp.rol,
                diasTrabajados,
                horasPresencia: totalHoras,
                totalKm,
                totalDescargas,
                totalViajes,
                totalDietas,
                totalProductividad,
                totalIncentivos,
                horasExtrasFestivos: horasExtrasFestivos > 0 ? parseFloat(horasExtrasFestivos.toFixed(2)) : '',
                diasBaja: esBajaLarga ? diasBaja : '',
                bajaLarga: esBajaLarga ? 'SI' : '',
                tieneNominaGuardada: !!savedNomina
            };
        });

        // Sort by Role first, then Name
        reportData.sort((a, b) => {
            if (a.rol < b.rol) return -1;
            if (a.rol > b.rol) return 1;
            return a.nombre.localeCompare(b.nombre);
        });

        // Calculate Totals Row
        const totals = {
            id: 'TOTAL',
            nombre: 'TOTAL',
            apellidos: '',
            dni: '',
            rol: '',
            diasTrabajados: reportData.reduce((acc, curr) => acc + (Number(curr.diasTrabajados) || 0), 0),
            horasPresencia: reportData.reduce((acc, curr) => acc + (Number(curr.horasPresencia) || 0), 0),
            totalKm: reportData.reduce((acc, curr) => acc + (Number(curr.totalKm) || 0), 0),
            totalDietas: reportData.reduce((acc, curr) => acc + (Number(curr.totalDietas) || 0), 0),
            totalProductividad: reportData.reduce((acc, curr) => acc + (Number(curr.totalProductividad) || 0), 0),
            totalIncentivos: reportData.reduce((acc, curr) => acc + (Number(curr.totalIncentivos) || 0), 0),
            horasExtrasFestivos: reportData.reduce((acc, curr) => acc + (Number(curr.horasExtrasFestivos) || 0), 0),
            diasBaja: reportData.reduce((acc, curr) => acc + (Number(curr.diasBaja) || 0), 0),
            bajaLarga: ''
        };

        return NextResponse.json({ data: reportData, totals });

    } catch (error) {
        console.error('Error exporting gestoria report:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
