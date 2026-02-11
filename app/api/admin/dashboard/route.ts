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

        // DATES
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // SECTION 1: CRITICAL STATUS
        // 1.1 Urgent Tasks (High Priority & Open)
        const criticalTasks = await prisma.tarea.findMany({
            where: {
                estado: { notIn: ['COMPLETADA', 'CANCELADA'] },
                prioridad: 'ALTA'
            },
            select: { id: true, titulo: true, matricula: true, estado: true },
            take: 5
        });

        // 1.2 Pending Urgent Absences (Starting soon or already started and pending)
        const criticalAbsences = await prisma.ausencia.findMany({
            where: {
                estado: 'PENDIENTE',
                fechaInicio: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } // Next 7 days
            },
            include: { empleado: { select: { nombre: true, apellidos: true } } },
            take: 5
        });

        // 1.3 Critical Expirations (< 7 days) logic below...

        // SECTION 2: OPERATIONS TODAY
        const activeEmployees = await prisma.empleado.count({ where: { activo: true } });
        const workingNow = await prisma.jornadaLaboral.count({ where: { estado: 'TRABAJANDO' } });
        const driversOnRoute = await prisma.jornadaLaboral.count({
            where: {
                estado: 'TRABAJANDO',
                empleado: { rol: 'CONDUCTOR' }
            }
        });
        const incidentsToday = await prisma.tarea.count({
            where: { createdAt: { gte: startOfToday } }
        });

        // SECTION 3: MONTHLY PERFORMANCE
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

        // KPI Calculations
        const productivity = activeEmployees > 0 ? (totalMonthlyHours / activeEmployees) : 0; // Hours/Emp
        const estimatedLaborCost = totalMonthlyHours * 15; // Placeholder val

        // Absenteeism (Days of absence this month)
        const absencesThisMonth = await prisma.ausencia.count({ // Simplified count of records
            where: {
                fechaInicio: { gte: startOfMonth }
            }
        });
        const absenteeismPct = activeEmployees > 0 ? ((absencesThisMonth / (activeEmployees * 20)) * 100) : 0; // Approx

        // SECTION 4: RISK & COMPLIANCE (Expirations)
        const expirationThreshold = new Date();
        expirationThreshold.setDate(expirationThreshold.getDate() + 40); // 40 days lookahead for Risks
        const criticalThreshold = new Date();
        criticalThreshold.setDate(criticalThreshold.getDate() + 7); // 7 days for Critical

        // Trucks
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

        // Employees
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

        // Process Expirations into Critical vs Risk
        const criticalExpirations: any[] = [];
        const riskExpirations: any[] = [];

        const processAlert = (date: Date | null, type: string, entity: string, id: number, entityType: string) => {
            if (!date) return;
            const isExpired = date < now;
            const isCritical = date <= criticalThreshold;

            const alert = {
                id,
                entityName: entity,
                entityType,
                alertType: type,
                date,
                isExpired,
                daysRemaining: Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            };

            if (isCritical || isExpired) {
                criticalExpirations.push(alert);
            } else {
                riskExpirations.push(alert);
            }
        };

        expiringTrucks.forEach(t => {
            processAlert(t.itvVencimiento, 'ITV', t.matricula, t.id, 'TRUCK');
            processAlert(t.seguroVencimiento, 'Seguro', t.matricula, t.id, 'TRUCK');
            processAlert(t.tacografoVencimiento, 'Tacógrafo', t.matricula, t.id, 'TRUCK');
            processAlert(t.adrVencimiento, 'ADR', t.matricula, t.id, 'TRUCK');
        });

        expiringEmployees.forEach(e => {
            const p = e.perfilProfesional;
            if (p) {
                const name = `${e.nombre} ${e.apellidos || ''}`.trim();
                processAlert(p.dniCaducidad, 'DNI', name, e.id, 'EMPLOYEE');
                processAlert(p.carnetCaducidad, 'Carnet', name, e.id, 'EMPLOYEE');
                processAlert(p.adrCaducidad, 'ADR', name, e.id, 'EMPLOYEE');
            }
        });

        // Sort
        criticalExpirations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        riskExpirations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return NextResponse.json({
            section1: {
                criticalTasks,
                criticalAbsences,
                criticalExpirations,
                isStable: criticalTasks.length === 0 && criticalAbsences.length === 0 && criticalExpirations.length === 0
            },
            section2: {
                workingNow,
                driversOnRoute,
                activeTrucks: await prisma.camion.count({ where: { activo: true } }),
                incidentsToday
            },
            section3: {
                totalMonthlyHours,
                productivity: parseFloat(productivity.toFixed(1)),
                totalMonthlyKm,
                estimatedLaborCost,
                absenteeismPct: parseFloat(absenteeismPct.toFixed(1))
            },
            section4: {
                riskExpirations
            }
        });

    } catch (error) {
        console.error('GET /api/admin/dashboard error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

    } catch (error) {
    console.error('GET /api/admin/dashboard error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
}
}
