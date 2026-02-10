import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { jornadaId, camionId, horaInicio, kmInicial, confirmConflict, foto } = body;

        if (!jornadaId || !camionId || kmInicial === undefined) {
            return NextResponse.json({ error: 'Faltan datos obligatorios para iniciar ruta' }, { status: 400 });
        }

        const kInitial = parseInt(kmInicial);

        const lastUsage = await prisma.usoCamion.findFirst({
            where: { camionId: parseInt(camionId) },
            orderBy: { createdAt: 'desc' }
        });

        if (lastUsage && lastUsage.kmFinal) {
            // Check for conflict
            if (kInitial < lastUsage.kmFinal) {
                // Hard block if new KM is less than old KM (potential rollback fraud or huge error)
                // Unless explicitly handled, but usually this is an error. user said "inconsistent", usually means gap.
                // If kInitial != lastUsage.kmFinal (less or more). User specifically mentioned "option to make a picture and modify them".
                // Usually inconsistencies are: New KM > Old KM (forgot to log usage?) OR New KM < Old KM (error in previous log).
                // The prompt implies we fix the "previous conductor" final KM. 
                // If New < Old: Previous put too much.
                // If New > Old: Previous put too little.
            }

            if (kInitial !== lastUsage.kmFinal) {
                if (!confirmConflict || !foto) {
                    return NextResponse.json({
                        error: `Los KM no coinciden con el final anterior (${lastUsage.kmFinal} km).`,
                        conflict: true,
                        expectedKm: lastUsage.kmFinal,
                        requireEvidence: true
                    }, { status: 409 });
                }

                // Fix previous usage
                await prisma.usoCamion.update({
                    where: { id: lastUsage.id },
                    data: {
                        kmFinal: kInitial,
                        kmRecorridos: kInitial - lastUsage.kmInicial
                    }
                });

                // Notify Admin
                // Assuming we have an ADMIN user or a specific way to notify. 
                // Creating a Notification record linked to no specific user (global) or all admins.
                // For now, let's try to notify the admin user if exists, or just create a generic notification if schema supports it.
                // Schema has `Notificacion` linked to `Empleado`. We need to find Admins.
                const admins = await prisma.empleado.findMany({ where: { rol: 'ADMIN' } });
                for (const admin of admins) {
                    await prisma.notificacion.create({
                        data: {
                            usuarioId: admin.id,
                            mensaje: `Descuadre de KM en camión ${camionId} corregido. Anterior: ${lastUsage.kmFinal}, Corregido: ${kInitial}. Foto: Sí.`
                        }
                    });
                }
            }
        }

        const uso = await prisma.usoCamion.create({
            data: {
                jornadaId: parseInt(jornadaId),
                camionId: parseInt(camionId),
                horaInicio: new Date(horaInicio),
                kmInicial: kInitial,
                fotoKmInicial: foto || null
            }
        });

        return NextResponse.json(uso);
    } catch (error) {
        console.error('POST /api/turnos error:', error);
        return NextResponse.json({ error: 'Error al iniciar ruta' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, horaFin, kmFinal, descargasCount, viajesCount, litrosRepostados } = body;

        if (!id || kmFinal === undefined) {
            return NextResponse.json({ error: 'ID y KM finales son requeridos' }, { status: 400 });
        }

        const kFinal = parseInt(kmFinal);

        const current = await prisma.usoCamion.findUnique({ where: { id: parseInt(id) } });
        if (!current) return NextResponse.json({ error: 'Tramo no encontrado' }, { status: 404 });

        if (kFinal < current.kmInicial) {
            return NextResponse.json({ error: 'Los KM finales no pueden ser menores que los iniciales' }, { status: 400 });
        }

        const data: any = {
            horaFin: new Date(horaFin),
            kmFinal: kFinal,
            kmRecorridos: kFinal - current.kmInicial
        };

        if (descargasCount !== undefined && descargasCount !== '') data.descargasCount = parseInt(descargasCount);
        if (viajesCount !== undefined && viajesCount !== '') data.viajesCount = parseInt(viajesCount);
        if (litrosRepostados !== undefined && litrosRepostados !== '') data.litrosRepostados = parseFloat(litrosRepostados);

        const uso = await prisma.usoCamion.update({
            where: { id: parseInt(id) },
            data
        });
        return NextResponse.json(uso);
    } catch (error) {
        console.error('PUT /api/turnos error:', error);
        return NextResponse.json({ error: 'Error al finalizar ruta' }, { status: 500 });
    }
}
