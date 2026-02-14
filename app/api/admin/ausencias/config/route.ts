import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        let config = await prisma.configuracionAusencias.findFirst();

        if (!config) {
            config = await prisma.configuracionAusencias.create({
                data: {
                    habilitarAutoAprobacion: false,
                    autoAprobarDias: 1,
                    diasAntelacion: 7
                }
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error getting config:', error);
        return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session || session.rol !== 'ADMIN') {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { habilitarAutoAprobacion, autoAprobarDias, diasAntelacion } = body;

        let config = await prisma.configuracionAusencias.findFirst();

        if (config) {
            config = await prisma.configuracionAusencias.update({
                where: { id: config.id },
                data: {
                    habilitarAutoAprobacion,
                    autoAprobarDias,
                    diasAntelacion,
                    updatedBy: Number(session.id)
                }
            });
        } else {
            config = await prisma.configuracionAusencias.create({
                data: {
                    habilitarAutoAprobacion,
                    autoAprobarDias,
                    diasAntelacion,
                    updatedBy: Number(session.id)
                }
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating config:', error);
        return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
    }
}
