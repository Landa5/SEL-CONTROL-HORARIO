import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const clientes = await prisma.clienteAlquiler.findMany({
            orderBy: { nombre: 'asc' }
        });
        return NextResponse.json(clientes);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching clients' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nombre, telefono } = body;

        const client = await prisma.clienteAlquiler.create({
            data: { nombre, telefono }
        });
        return NextResponse.json(client);
    } catch (error) {
        return NextResponse.json({ error: 'Error creating client' }, { status: 500 });
    }
}
