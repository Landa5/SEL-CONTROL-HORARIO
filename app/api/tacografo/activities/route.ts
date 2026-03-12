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
    const vehicleId = searchParams.get('vehicleId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const activityType = searchParams.get('activityType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (driverId) where.driverId = parseInt(driverId);
    if (vehicleId) where.vehicleId = parseInt(vehicleId);
    if (activityType) where.activityType = activityType;
    if (dateFrom) where.startTime = { ...where.startTime, gte: new Date(dateFrom) };
    if (dateTo) where.startTime = { ...where.startTime, lte: new Date(dateTo + 'T23:59:59') };

    const [activities, total] = await Promise.all([
      prisma.tachographActivity.findMany({
        where,
        include: {
          driver: { select: { id: true, fullName: true, linkedEmployee: { select: { nombre: true, apellidos: true } } } },
          vehicle: { select: { id: true, plateNumber: true, linkedVehicle: { select: { matricula: true } } } },
        },
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tachographActivity.count({ where }),
    ]);

    return NextResponse.json({ data: activities, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    console.error('GET /api/tacografo/activities error:', error);
    return NextResponse.json({ error: 'Error al obtener actividades' }, { status: 500 });
  }
}
