import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA' && user.rol !== 'MECANICO')) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // ==========================================
        // SECTION 1: CRITICAL GLOBAL (Action required)
        // ==========================================

        // 1.1 Critical Tasks (High Priority or averias)
        const criticalTasks = await prisma.tarea.findMany({
            where: {
                estado: { notIn: ['COMPLETADA', 'CANCELADA'] },
                prioridad: 'ALTA'
            },
            select: { id: true, titulo: true, matricula: true, estado: true },
            take: 5
        });

        // 1.2 Urgent Absences (Pending & starting soon)
        const urgentAbsences = await prisma.ausencia.findMany({
            where: {
                estado: 'PENDIENTE',
                fechaInicio: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
            },
            include: { empleado: { select: { nombre: true, apellidos: true } } },
            take: 5
        });

        // 1.3 Expirations
        // 'now' is defined at top

        // Thresholds
        const vehicleThreshold = new Date();
        vehicleThreshold.setDate(vehicleThreshold.getDate() + 40); // 40 days for Vehicles (ITV, Seguro, ADR, Tacógrafo)

        const employeeThreshold = new Date();
        employeeThreshold.setMonth(employeeThreshold.getMonth() + 12); // 12 months for Employees (DNI, Carnet, ADR)

        // Fetch Trucks Expirations
        const expiringTrucks = await prisma.camion.findMany({
            where: {
                activo: true,
                OR: [
                    { itvVencimiento: { lte: vehicleThreshold } },
                    { seguroVencimiento: { lte: vehicleThreshold } },
                    { tacografoVencimiento: { lte: vehicleThreshold } },
                    { adrVencimiento: { lte: vehicleThreshold } }
                ]
            },
            select: { id: true, matricula: true, itvVencimiento: true, seguroVencimiento: true, tacografoVencimiento: true, adrVencimiento: true }
        });

        // Fetch Employees Expirations
        const expiringEmployees = await prisma.empleado.findMany({
            where: {
                activo: true,
                perfilProfesional: {
                    OR: [
                        { dniCaducidad: { lte: employeeThreshold } },
                        { carnetCaducidad: { lte: employeeThreshold } },
                        { adrCaducidad: { lte: employeeThreshold } }
                    ]
                }
            },
            select: { id: true, nombre: true, apellidos: true, perfilProfesional: true }
        });

        const criticalAlerts: any[] = [];

        // Helper to push alerts
        const pushAlert = (date: Date | null, type: string, text: string, id: number, entity: 'TRUCK' | 'EMPLOYEE', threshold: Date) => {
            if (!date) return;
            if (date <= threshold) {
                const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                // Determine severity
                let severity = 'INFO';
                if (days < 0) severity = 'CRITICAL';
                else if (days < 30) severity = 'WARNING';

                criticalAlerts.push({
                    id,
                    type: 'VENCIMIENTO',
                    alertType: type, // For FleetAlertsWidget (ITV, ADR...)
                    message: `${type} ${days < 0 ? 'CADUCADO' : `vence en ${days} días`}`,
                    entity: text,
                    entityName: text, // For FleetAlertsWidget
                    entityType: entity,
                    severity,
                    date: date, // For FleetAlertsWidget sorting/display
                    isExpired: days < 0 // For FleetAlertsWidget styling
                });
            }
        };

        expiringTrucks.forEach(t => {
            pushAlert(t.itvVencimiento, 'ITV', t.matricula, t.id, 'TRUCK', vehicleThreshold);
            pushAlert(t.seguroVencimiento, 'Seguro', t.matricula, t.id, 'TRUCK', vehicleThreshold);
            pushAlert(t.tacografoVencimiento, 'Tacógrafo', t.matricula, t.id, 'TRUCK', vehicleThreshold);
            pushAlert(t.adrVencimiento, 'ADR', t.matricula, t.id, 'TRUCK', vehicleThreshold);
        });

        expiringEmployees.forEach(e => {
            if (e.perfilProfesional) {
                const name = `${e.nombre} ${e.apellidos || ''}`;
                pushAlert(e.perfilProfesional.dniCaducidad, 'DNI', name, e.id, 'EMPLOYEE', employeeThreshold);
                pushAlert(e.perfilProfesional.carnetCaducidad, 'Carnet', name, e.id, 'EMPLOYEE', employeeThreshold);
                pushAlert(e.perfilProfesional.adrCaducidad, 'ADR', name, e.id, 'EMPLOYEE', employeeThreshold);
            }
        });

        // 1.4 Active Breakdowns (Added for Office Visibility)
        const activeBreakdowns = await prisma.tarea.findMany({
            where: {
                tipo: 'TALLER' as any,
                estado: { notIn: ['COMPLETADA', 'CANCELADA'] }
            },
            include: { camion: { select: { matricula: true, modelo: true } } },
            orderBy: { createdAt: 'desc' }
        });

        activeBreakdowns.forEach((b: any) => {
            // Explicitly cast 'b' to any to avoid 'camion' property missing error if types are stale
            const isUrgent = b.prioridad === 'ALTA' || b.prioridad === 'URGENTE';

            criticalAlerts.push({
                id: b.id,
                type: 'AVERIA',
                alertType: 'AVERÍA',
                message: b.titulo,
                entity: b.camion ? b.camion.matricula : 'General',
                entityName: b.camion ? b.camion.matricula : 'Taller',
                entityType: 'TRUCK',
                severity: isUrgent ? 'CRITICAL' : 'WARNING',
                date: b.createdAt,
                isExpired: true
            });
        });

        // ==========================================
        // SECTION 2: OPERATION TODAY
        // ==========================================
        const workingNow = await prisma.jornadaLaboral.count({ where: { estado: 'TRABAJANDO' } });

        // Active "Uses" of trucks today (implies trucks on route)
        const activeTrucks = await prisma.usoCamion.count({
            where: {
                horaFin: null, // Still active
                horaInicio: { gte: startOfToday }
            }
        });

        const incidentsToday = await prisma.tarea.count({
            where: { createdAt: { gte: startOfToday }, tipo: 'OPERATIVA' }
        });

        const absentToday = await prisma.ausencia.count({
            where: {
                fechaInicio: { lte: now },
                fechaFin: { gte: now },
                estado: 'APROBADA'
            }
        });

        // ==========================================
        // SECTION 3: MONTHLY PERFORMANCE
        // ==========================================
        const monthlyHoursAgg = await prisma.jornadaLaboral.aggregate({
            where: { fecha: { gte: startOfMonth }, estado: 'CERRADA' },
            _sum: { totalHoras: true }
        });
        const totalMonthlyHours = monthlyHoursAgg._sum.totalHoras || 0;

        const monthlyKmAgg = await prisma.usoCamion.aggregate({
            where: { horaInicio: { gte: startOfMonth } },
            _sum: { kmRecorridos: true }
        });
        const totalMonthlyKm = monthlyKmAgg._sum.kmRecorridos || 0;

        const activeEmployeesCount = await prisma.empleado.count({ where: { activo: true } });

        // Fake calculation for "Coste Laboral Estimado" (Simplification)
        const estimatedLaborCost = totalMonthlyHours * 14.5; // Example hourly rate avg

        const productivity = activeEmployeesCount > 0 ? (totalMonthlyHours / activeEmployeesCount) : 0;

        // Absenteeism calculation
        const absencesThisMonth = await prisma.ausencia.count({
            where: { fechaInicio: { gte: startOfMonth } }
        });
        const absenteeismPct = activeEmployeesCount > 0 ? ((absencesThisMonth / (activeEmployeesCount * 22)) * 100) : 0;


        // ==========================================
        // SECTION 4: CONTROL & COMPLIANCE
        // ==========================================

        // RRHH: Contracts/Docs expiring soon (using Documento model from Phase 10)
        // Note: 'Documento' model is not fully integrated yet.
        const rrhhDocsPending = await prisma.documento.count({
            where: {
                tipo: 'CONTRATO',
                fechaCaducidad: { lte: vehicleThreshold } // Reusing 40 days threshold for contracts
            }
        });

        // Flota: Maintenance Next
        const nextMaintenances = await prisma.mantenimientoProximo.count({
            where: { estado: 'PROGRAMADO' }
        });

        // Admin: Payrolls Drafting
        const pendingPayrolls = await prisma.nominaMes.count({
            where: { estado: 'BORRADOR' }
        });


        // ==========================================
        // BUILD RESPONSE
        // ==========================================
        return NextResponse.json({
            section1: {
                criticalTasks,
                urgentAbsences,
                criticalAlerts, // Combined expirations
                isStable: criticalTasks.length === 0 && urgentAbsences.length === 0 && criticalAlerts.length === 0
            },
            section2: {
                workingNow,
                activeTrucks,
                incidentsToday,
                absentToday
            },
            section3: {
                totalMonthlyHours,
                productivity: parseFloat(productivity.toFixed(1)),
                totalMonthlyKm,
                estimatedLaborCost,
                absenteeismPct: parseFloat(absenteeismPct.toFixed(1))
            },
            section4: {
                rrhh: {
                    docsExpiring: rrhhDocsPending,
                    trainingPending: 0 // Placeholder
                },
                flota: {
                    maintenanceNext: nextMaintenances,
                    docsExpiring: expiringTrucks.length // Reuse count
                },
                admin: {
                    payrollsPending: pendingPayrolls,
                    accountingIssues: 0 // Placeholder
                }
            }
        });

    } catch (error) {
        console.error('GET /api/admin/dashboard error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}


