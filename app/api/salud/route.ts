import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const empleados = await prisma.empleado.count();
        return NextResponse.json({
            ok: true,
            servicio: 'sel-control-horario',
            baseDatos: 'postgresql-vps',
            empleados,
            fecha: new Date().toISOString(),
        });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error?.message || 'Error de conexión a base de datos' },
            { status: 500 }
        );
    }
}
