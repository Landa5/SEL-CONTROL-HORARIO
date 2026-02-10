import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request: Request) {
    // Optional: Add a secure key check here if publicly exposed
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    try {
        const profesionales = await prisma.perfilProfesional.findMany({
            include: {
                empleado: { select: { id: true, nombre: true, apellidos: true, rol: true } }
            }
        });

        const adminsAndOffice = await prisma.empleado.findMany({
            where: {
                rol: { in: ['ADMIN', 'OFICINA'] },
                activo: true
            },
            select: { id: true, email: true }
        });

        const adminIds = adminsAndOffice.map(u => u.id);
        const alertsSent = [];

        const today = new Date();
        const warningThreshold = new Date();
        warningThreshold.setDate(today.getDate() + 365); // 1 year from now

        for (const prof of profesionales) {
            const checks = [
                { type: 'DNI', date: prof.dniCaducidad },
                { type: 'CARNET', date: prof.carnetCaducidad },
                { type: 'ADR', date: prof.tieneAdr ? prof.adrCaducidad : null }
            ];

            for (const check of checks) {
                if (!check.date) continue;

                const expiryDate = new Date(check.date);

                // If expiry is in the past OR within 1 year
                if (expiryDate <= warningThreshold) {

                    // Check if we already alerted recently (e.g., in the last 7 days)
                    // We don't want to spam daily. Let's say weekly reminders.
                    const lastAlert = await prisma.alertaDocumento.findFirst({
                        where: {
                            empleadoId: prof.empleadoId,
                            documento: check.type,
                            fechaEnvio: {
                                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
                            }
                        }
                    });

                    if (lastAlert) continue; // Already alerted this week

                    const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = daysRemaining < 0;

                    const message = isExpired
                        ? `URGENTE: El documento ${check.type} de ${prof.empleado.nombre} ${prof.empleado.apellidos || ''} HA CADUCADO el ${expiryDate.toLocaleDateString()}.`
                        : `AVISO: El documento ${check.type} de ${prof.empleado.nombre} ${prof.empleado.apellidos || ''} caducará en ${daysRemaining} días (${expiryDate.toLocaleDateString()}).`;

                    // 1. Create In-App Notifications for Admins/Office
                    // We create one notification record per recipient
                    const notificationsData = adminIds.map(userId => ({
                        usuarioId: userId,
                        mensaje: message,
                        link: `/admin/empleados?id=${prof.empleadoId}`, // Link to employee edit
                        leida: false
                    }));

                    await prisma.notificacion.createMany({
                        data: notificationsData
                    });

                    // 2. Log in AlertaDocumento (Audit & Throttling)
                    await prisma.alertaDocumento.create({
                        data: {
                            empleadoId: prof.empleadoId,
                            documento: check.type,
                            fechaCaducidad: expiryDate,
                            diasRestantes: daysRemaining,
                            destinatarios: JSON.stringify(adminIds),
                            fechaEnvio: new Date()
                        }
                    });

                    alertsSent.push({
                        empleado: prof.empleado.nombre,
                        documento: check.type,
                        diasRestantes: daysRemaining
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            alertsProcessed: alertsSent.length,
            details: alertsSent
        });

    } catch (error: any) {
        console.error("Cron Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
