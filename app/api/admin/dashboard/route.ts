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
        if (!user || (user.rol !== 'ADMIN' && user.rol !== 'OFICINA')) {
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

        // 1.3 Expirations (< 15 days)
        const expirationThreshold = new Date();
        expirationThreshold.setDate(expirationThreshold.getDate() + 15);

        // Fetch Trucks Expirations
        const expiringTrucks = await prisma.camion.findMany({
            where: {
                activo: true,
                OR: [
                    { itvVencimiento: { lte: expirationThreshold } },
                    { seguroVencimiento: { lte: expirationThreshold } },
                    { tacografoVencimiento: { lte: expirationThreshold } },
                    { adrVencimiento: { lte: expirationThreshold } }
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
                        { dniCaducidad: { lte: expirationThreshold } },
                        { carnetCaducidad: { lte: expirationThreshold } },
                        { adrCaducidad: { lte: expirationThreshold } }
                    ]
                }
            },
            select: { id: true, nombre: true, apellidos: true, perfilProfesional: true }
        });

        const criticalAlerts: any[] = [];

        // Helper to push alerts
        const pushAlert = (date: Date | null, type: string, text: string, id: number, entity: 'TRUCK' | 'EMPLOYEE') => {
            if (!date) return;
            // Only push if < 15 days
            if (date <= expirationThreshold) {
                const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                criticalAlerts.push({
                    id,
                    type: 'VENCIMIENTO',
                    message: `${type} ${days < 0 ? 'CADUCADO' : `vence en ${days} días`}`,
                    entity: text,
                    entityType: entity,
                    severity: days < 0 ? 'CRITICAL' : 'WARNING'
                });
            }
        };

        expiringTrucks.forEach(t => {
            pushAlert(t.itvVencimiento, 'ITV', t.matricula, t.id, 'TRUCK');
            pushAlert(t.seguroVencimiento, 'Seguro', t.matricula, t.id, 'TRUCK');
            pushAlert(t.tacografoVencimiento, 'Tacógrafo', t.matricula, t.id, 'TRUCK');
            pushAlert(t.adrVencimiento, 'ADR', t.matricula, t.id, 'TRUCK');
        });

        expiringEmployees.forEach(e => {
            if (e.perfilProfesional) {
                const name = `${e.nombre} ${e.apellidos || ''}`;
                pushAlert(e.perfilProfesional.dniCaducidad, 'DNI', name, e.id, 'EMPLOYEE');
                pushAlert(e.perfilProfesional.carnetCaducidad, 'Carnet', name, e.id, 'EMPLOYEE');
                pushAlert(e.perfilProfesional.adrCaducidad, 'ADR', name, e.id, 'EMPLOYEE');
            }
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
        const rrhhDocsPending = await prisma.documento.count({
            where: {
                tipo: 'CONTRATO',
                fechaCaducidad: { lte: expirationThreshold } // reusing 15 days threshold
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


