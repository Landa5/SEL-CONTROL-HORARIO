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
    const consolidationStatus = searchParams.get('consolidationStatus');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (driverId) where.driverId = parseInt(driverId);
    if (vehicleId) where.vehicleId = parseInt(vehicleId);
    if (activityType) where.normalizedActivityType = activityType;
    if (consolidationStatus) where.consolidationStatus = consolidationStatus;
    
    // Filtrar por operationalDayLocal (tipo Date)
    if (dateFrom || dateTo) {
      where.operationalDayLocal = {};
      if (dateFrom) where.operationalDayLocal.gte = new Date(dateFrom);
      if (dateTo) where.operationalDayLocal.lte = new Date(dateTo);
    }

    const [activities, total] = await Promise.all([
      prisma.tachographNormalizedEvent.findMany({
        where,
        include: {
          driver: { select: { id: true, fullName: true, linkedEmployee: { select: { nombre: true, apellidos: true } } } },
          vehicle: { select: { id: true, plateNumber: true, linkedVehicle: { select: { matricula: true } } } },
        },
        orderBy: { startAtUtc: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tachographNormalizedEvent.count({ where }),
    ]);

    // Transformar respuesta para mantener compatibilidad y añadir campos v2
    const data = activities.map(a => ({
      id: a.id,
      importId: a.importId,
      sourceType: a.sourceType,
      driverId: a.driverId,
      vehicleId: a.vehicleId,
      activityType: a.normalizedActivityType,
      startTime: a.startAtUtc,
      endTime: a.endAtUtc,
      startAtLocal: a.startAtLocal,
      endAtLocal: a.endAtLocal,
      operationalDayLocal: a.operationalDayLocal,
      durationMinutes: a.durationMinutes,
      confidenceLevel: a.confidenceLevel,
      matchingStatus: a.matchingStatus,
      consolidationStatus: a.consolidationStatus,
      extractionMethod: a.extractionMethod,
      isSplitCrossMidnight: a.isSplitCrossMidnight,
      driver: a.driver,
      vehicle: a.vehicle,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    console.error('GET /api/tacografo/activities error:', error);
    return NextResponse.json({ error: 'Error al obtener actividades' }, { status: 500 });
  }
}
