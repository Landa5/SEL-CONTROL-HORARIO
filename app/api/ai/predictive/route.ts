import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

// Heuristic-based "AI" Predictive Maintenance Engine
export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('session')?.value;
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const user: any = await verifyToken(session);
        if (!user || !['ADMIN', 'OFICINA', 'MECANICO'].includes(user.rol)) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        // Explicitly type the result from Prisma to avoid TS errors with count and includes
        const camiones = await prisma.camion.findMany({
            where: { activo: true },
            include: {
                _count: {
                    select: { tareas: { where: { estado: 'ABIERTA' } } }
                },
                mantenimientos: {
                    take: 5,
                    orderBy: { fecha: 'desc' }
                }
            } as any // Bypass strict typing for extended relation
        });

        console.log(`[PredictiveAPI] Found ${camiones.length} active trucks.`);

        const tareasRecientes = await prisma.tarea.findMany({
            where: {
                createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, // Last 60 days
                activoTipo: 'CAMION'
            }
        });

        console.log(`[PredictiveAPI] Found ${tareasRecientes.length} recent tasks.`);

        const insights = camiones.map((truck: any) => {
            const truckTasks = tareasRecientes.filter(t => t.matricula === truck.matricula);
            const truckInvoices = truck.mantenimientos || [];

            const alerts: string[] = [];
            let healthScore = 100;

            // 1. Analysis by Recurrence (Internal Tasks + External Invoices)
            // Combine descriptions for analysis
            const internalText = truckTasks.map(t => (t.titulo + ' ' + t.descripcion).toLowerCase()).join(' ');
            const externalText = truckInvoices.map((m: any) => (m.descripcion + ' ' + (m.piezasCambiadas || '')).toLowerCase()).join(' ');
            const fullHistory = internalText + ' ' + externalText;

            const engineCount = (fullHistory.match(/motor|aceite|cilindro|inyec/g) || []).length;
            const brakeCount = (fullHistory.match(/freno|pastilla|disco/g) || []).length;
            const tireCount = (fullHistory.match(/rueda|neumatico|pinchazo/g) || []).length;

            if (engineCount >= 3) {
                alerts.push("Alerta Crítica: Múltiples intervenciones de motor recientes (Taller/Interno).");
                healthScore -= 45;
            } else if (engineCount === 2) {
                alerts.push("Atención: Revisión de motor recurrente.");
                healthScore -= 15;
            }

            if (brakeCount >= 2) {
                alerts.push("Desgaste acelerado en sistema de frenos detectado.");
                healthScore -= 25;
            }

            if (tireCount >= 3) {
                alerts.push("Alta frecuencia de incidencias en neumáticos.");
                healthScore -= 10;
            }

            // 2. Analysis by Mileage vs Last Maintenance
            // Try to find last oil change in invoices
            const lastOilChange = truckInvoices.find((m: any) =>
                (m.piezasCambiadas && m.piezasCambiadas.toLowerCase().includes('aceite')) ||
                m.descripcion.toLowerCase().includes('mantenimiento')
            );

            let kmSinceService = truck.kmActual;
            if (lastOilChange && lastOilChange.kmEnEseMomento) {
                kmSinceService = truck.kmActual - lastOilChange.kmEnEseMomento;
            } else {
                // Fallback if no invoice found (heuristic modulo)
                kmSinceService = truck.kmActual % 40000;
            }

            if (kmSinceService > 35000) {
                alerts.push(`Mantenimiento preventivo necesario (+${Math.floor(kmSinceService / 1000)}k km desde última revisión).`);
                healthScore -= 20;
            }

            // 3. Status Analysis (Open Tasks)
            // Use optional chaining or safe access for _count
            const openTasks = truck._count?.tareas || 0;
            if (openTasks > 0) {
                alerts.push(`${openTasks} incidencia(s) abierta(s) en taller interno.`);
                healthScore -= 10 * openTasks;
            }

            // 4. Invoices Analysis (Cost Spikes)
            const recentHighCost = truckInvoices.some((m: any) => (m.costo || 0) > 1000);
            if (recentHighCost) {
                alerts.push("Facturación elevada reciente: Verificar garantías de reparaciones.");
                healthScore -= 5;
            }

            return {
                id: truck.id,
                matricula: truck.matricula,
                model: truck.modelo,
                kmActual: truck.kmActual,
                healthScore: Math.max(0, healthScore),
                alerts,
                status: healthScore > 85 ? 'EXCELENTE' : healthScore > 50 ? 'PREVENTIVO' : 'CRÍTICO'
            };
        });

        // Sort by health score (ascending - worst first)
        insights.sort((a: any, b: any) => a.healthScore - b.healthScore);

        // Filter: Show bad scores, alerts, OR at least the top 5 validation entries if everything is perfect
        // This ensures the user sees that the system is working even if everything is "Perfect"
        const fleetHealth = insights.filter((i: any) => i.healthScore < 100 || i.alerts.length > 0);

        // If list is empty (Super healthy fleet), take top 3 high-mileage trucks to show *something*
        if (fleetHealth.length === 0) {
            return NextResponse.json(insights.sort((a: any, b: any) => b.kmActual - a.kmActual).slice(0, 3));
        }

        return NextResponse.json(fleetHealth);

    } catch (error) {
        console.error('AI Predictive Error:', error);
        return NextResponse.json({ error: 'Error en análisis' }, { status: 500 });
    }
}
