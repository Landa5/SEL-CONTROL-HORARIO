import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        // @ts-ignore
        let config = await prisma.configuracionAusencias.findFirst();

        if (!config) {
            // Create default if not exists
            // @ts-ignore
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
        console.error('Error fetching absence config:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { habilitarAutoAprobacion, autoAprobarDias, diasAntelacion } = body;

        // Validation
        if (typeof habilitarAutoAprobacion !== 'boolean' ||
            typeof autoAprobarDias !== 'number' ||
            typeof diasAntelacion !== 'number') {
            return NextResponse.json({ error: 'Invalid data types' }, { status: 400 });
        }

        // @ts-ignore
        let config = await prisma.configuracionAusencias.findFirst();

        if (config) {
            // @ts-ignore
            config = await prisma.configuracionAusencias.update({
                where: { id: config.id },
                data: {
                    habilitarAutoAprobacion,
                    autoAprobarDias,
                    diasAntelacion,
                    updatedAt: new Date()
                    // updatedBy could be added if we had user context
                }
            });
        } else {
            // @ts-ignore
            config = await prisma.configuracionAusencias.create({
                data: {
                    habilitarAutoAprobacion,
                    autoAprobarDias,
                    diasAntelacion
                }
            });
        }

        return NextResponse.json(config);
    } catch (error) {
        console.error('Error updating absence config:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
