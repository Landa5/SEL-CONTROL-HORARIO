import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Find rentals active *during* this month
        // active = Start < EndOfMonth AND (End is NULL OR End > StartOfMonth)
        const rentals = await prisma.alquilerPlaza.findMany({
            where: {
                fechaInicio: { lte: endDate },
                OR: [
                    { fechaFin: null },
                    { fechaFin: { gte: startDate } }
                ]
            },
            include: {
                plaza: true,
                cliente: true
            }
        });

        // Calculate total amount per active rental
        // If a rental started mid-month or ended mid-month, logic might differ (prorated).
        // For simplicity: Full month price if active at any point? Or active on day 1?
        // Let's assume full price for simplicity unless specified otherwise.

        const reportData = rentals.map(r => ({
            plaza: `Plaza ${r.plaza.numero}`,
            cliente: r.cliente.nombre,
            matricula: r.matricula,
            precio: r.precioMensual,
            inicio: r.fechaInicio,
            fin: r.fechaFin || 'Vigente'
        }));

        const totalAmount = rentals.reduce((sum, r) => sum + r.precioMensual, 0);

        return NextResponse.json({
            month: `${month}/${year}`,
            rentals: reportData,
            totalAmount
        });

    } catch (error) {
        return NextResponse.json({ error: 'Error generating report' }, { status: 500 });
    }
}
