import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session')?.value;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user: any = await verifyToken(session);
    if (!user || !['ADMIN', 'OFICINA'].includes(user.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {};
    if (driverId) where.driverId = parseInt(driverId);
    if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
    if (dateTo) where.date = { ...where.date, lte: new Date(dateTo) };

    const summaries = await prisma.tachographDailySummary.findMany({
      where,
      include: {
        driver: { select: { id: true, fullName: true, linkedEmployee: { select: { nombre: true, apellidos: true } } } },
        vehicle: { select: { id: true, plateNumber: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    return NextResponse.json(summaries);
  } catch (error: any) {
    console.error('GET /api/tacografo/daily-summary error:', error);
    return NextResponse.json({ error: 'Error al obtener resúmenes' }, { status: 500 });
  }
}
