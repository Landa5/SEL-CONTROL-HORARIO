import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { endOfMonth } from 'date-fns';

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

            // 1. Employee Specific
            const empTarifa = concepto.tarifas.find(t => t.empleadoId === empId);
            if (empTarifa) return empTarifa.valor;

            // 2. Role Specific
            const roleTarifa = concepto.tarifas.find(t => t.rol === role && !t.empleadoId);
            if (roleTarifa) return roleTarifa.valor;

            // 3. Global
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
                usosCamion: { select: { kmRecorridos: true, litrosRepostados: true } },
            }
        });

        // Fetch Absences (Bajas) > 3 days
        const ausencias = await prisma.ausencia.findMany({
            where: {
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ],
                estado: 'APROBADA',
                tipo: 'BAJA_MEDICA'
            }
        });

        // -----------------------------
        // PROCESSING DATA PER EMPLOYEE
        // -----------------------------
        const reportData = empleados.map(emp => {
            const empJornadas = jornadas.filter(j => j.empleadoId === emp.id);

            let totalKm = 0;
            let diasTrabajados = 0;
            let totalHoras = 0;

            empJornadas.forEach(jor => {
                const km = jor.usosCamion.reduce((acc, uso) => acc + (uso.kmRecorridos || 0), 0);
                totalKm += km;
                diasTrabajados++;
                totalHoras += (jor.totalHoras || 0);
            });

            // Financials
            const dietasRate = getTarifa('DIETAS', emp.id, emp.rol);
            const totalDietas = diasTrabajados * dietasRate;

            const productividadFija = getTarifa('PRODUCTIVIDAD_FIJA', emp.id, emp.rol);
            const totalProductividad = productividadFija; // Fixed monthly

            const incentivosRate = getTarifa('INCENTIVOS', emp.id, emp.rol);
            const totalIncentivos = incentivosRate; // Fixed monthly? Or per trip? Assuming fixed for now.

            // EXTRA HOURS (ADMIN ONLY ON HOLIDAYS) - Simplified Logic
            let horasExtrasFestivos = 0;
            if (emp.rol === 'OFICINA' || emp.rol === 'ADMIN') {
                // Here we would check against holidays.
            }

            // BAJAS > 3 DAYS
            const baja = ausencias.find(a => a.empleadoId === emp.id);
            let diasBaja = 0;
            let esBajaLarga = false;

            if (baja) {
                const totalDuration = Math.ceil((Math.abs((baja.fechaFin || endDate).getTime() - baja.fechaInicio.getTime())) / (1000 * 3600 * 24)) + 1;

                if (totalDuration > 3) {
                    const start = baja.fechaInicio < startDate ? startDate : baja.fechaInicio;
                    const end = baja.fechaFin && baja.fechaFin < endDate ? baja.fechaFin : endDate;
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    diasBaja = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    esBajaLarga = true;
                }
            }

            return {
                id: emp.id,
                nombre: emp.nombre,
                apellidos: emp.apellidos || '',
                dni: emp.dni || '',
                rol: emp.rol,
                diasTrabajados,
                horasPresencia: totalHoras, // New field
                totalKm,
                totalDietas, // New field
                totalProductividad, // New field
                totalIncentivos, // New field
                horasExtrasFestivos: horasExtrasFestivos > 0 ? horasExtrasFestivos : '',
                diasBaja: esBajaLarga ? diasBaja : '',
                bajaLarga: esBajaLarga ? 'SI' : ''
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
