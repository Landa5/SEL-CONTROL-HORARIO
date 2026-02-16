import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        const permisos = await prisma.permiso.findMany({
            orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }]
        });

        // Group by category for easier frontend consumption
        const grouped = permisos.reduce((acc: any, curr) => {
            if (!acc[curr.categoria]) acc[curr.categoria] = [];
            acc[curr.categoria].push(curr);
            return acc;
        }, {});

        return NextResponse.json({ permisos, grouped });
    } catch (error: any) {
        console.error("GET /api/admin/roles/permisos Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
