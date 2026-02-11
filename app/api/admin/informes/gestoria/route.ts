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
                usosCamion: { select: { kmRecorridos: true, litrosRepostados: true } }, // Assuming diets might be calculated based on sorties or KM
                // We need to know if it was a Holiday (Festivo) for Administration Extra Hours
            }
        });

        // Fetch Absences (Bajas) > 3 days
        const ausencias = await prisma.ausencia.findMany({
            where: {
                OR: [
                    { fechaInicio: { lte: endDate }, fechaFin: { gte: startDate } }
                ],
                estado: 'APROBADA',
                tipo: 'BAJA_MEDICA' // Assuming this type exists or mapping 'ENFERMEDAD'
            }
        });

        // -----------------------------
        // PROCESSING DATA PER EMPLOYEE
        // -----------------------------
        const reportData = empleados.map(emp => {
            const empJornadas = jornadas.filter(j => j.empleadoId === emp.id);

            // 1. DIETAS & KILOMETRAJE
            // Assuming you have logic for Diets. For now, let's sum KM.
            // If Diets are per day worked or specific logic, adjust here.
            let totalKm = 0;
            let diasTrabajados = 0;
            let festivosTrabajados = 0;

            empJornadas.forEach(jor => {
                const km = jor.usosCamion.reduce((acc, uso) => acc + (uso.kmRecorridos || 0), 0);
                totalKm += km;
                diasTrabajados++;

                // Detect if Holiday (Festivo). Verification needed on how you store holidays.
                // Assuming `jor.esFestivo` or checking against a Holidays table.
                // For now, placeholder logic:
                // if (jor.esFestivo) festivosTrabajados++;
            });

            // 2. EXTRA HOURS (ADMIN ONLY ON HOLIDAYS)
            let horasExtrasFestivos = 0;
            if (emp.rol === 'OFICINA' || emp.rol === 'ADMIN') {
                // Logic: Sum hours worked on Holidays for Admin/Office
                // horasExtrasFestivos = empJornadas.filter(j => j.esFestivo).reduce((acc, j) => acc + (j.totalHoras || 0), 0);
            }

            // 3. BAJAS > 3 DAYS
            // Filter absences for this employee that are Sick Leave (Baja) and overlap month
            const baja = ausencias.find(a => a.empleadoId === emp.id);
            let diasBaja = 0;
            let esBajaLarga = false;

            if (baja) {
                const start = baja.fechaInicio < startDate ? startDate : baja.fechaInicio;
                const end = baja.fechaFin && baja.fechaFin < endDate ? baja.fechaFin : endDate;
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive

                // Check if total duration of absence (not just in month) is > 3 days
                const totalDuration = Math.ceil((Math.abs((baja.fechaFin || endDate).getTime() - baja.fechaInicio.getTime())) / (1000 * 3600 * 24)) + 1;

                if (totalDuration > 3) {
                    diasBaja = diffDays;
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
                totalKm,
                horasExtrasFestivos: horasExtrasFestivos > 0 ? horasExtrasFestivos : '', // Only show if positive
                diasBaja: esBajaLarga ? diasBaja : '', // Only show if > 3 days
                bajaLarga: esBajaLarga ? 'SI' : ''
            };
        });

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Error exporting gestoria report:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
