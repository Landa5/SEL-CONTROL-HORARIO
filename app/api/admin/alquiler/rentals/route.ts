import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { plazaId, clienteId, matricula, fechaInicio, precioMensual } = body;

        // Check if spot is occupied
        const existingRental = await prisma.alquilerPlaza.findFirst({
            where: { plazaId, activo: true }
        });

        if (existingRental) {
            return NextResponse.json({ error: 'La plaza ya está ocupada' }, { status: 400 });
        }

        const rental = await prisma.alquilerPlaza.create({
            data: {
                plazaId: parseInt(plazaId),
                clienteId: parseInt(clienteId),
                matricula,
                fechaInicio: new Date(fechaInicio),
                precioMensual: parseFloat(precioMensual),
                activo: true
            }
        });

        return NextResponse.json(rental);
    } catch (error) {
        return NextResponse.json({ error: 'Error creating rental' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rentalId, action } = body; // action: 'END', 'UPDATE'

        if (action === 'END') {
            const rental = await prisma.alquilerPlaza.update({
                where: { id: parseInt(rentalId) },
                data: {
                    activo: false,
                    fechaFin: new Date()
                }
            });
            return NextResponse.json(rental);
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: 'Error updating rental' }, { status: 500 });
    }
}
