import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // Ensure 9 spots exist
        const spotCount = await prisma.plazaGaraje.count();
        if (spotCount < 9) {
            for (let i = 1; i <= 9; i++) {
                await prisma.plazaGaraje.upsert({
                    where: { numero: i },
                    update: {},
                    create: { numero: i }
                });
            }
        }

        const spots = await prisma.plazaGaraje.findMany({
            orderBy: { numero: 'asc' },
            include: {
                alquileres: {
                    where: { activo: true },
                    include: { cliente: true }
                }
            }
        });

        return NextResponse.json(spots);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching dashboard' }, { status: 500 });
    }
}
