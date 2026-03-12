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
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const driverId = searchParams.get('driverId');
    const vehicleId = searchParams.get('vehicleId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = {};

    if (status) {
      where.importStatus = status;
    }
    if (dateFrom) {
      where.importDate = { ...where.importDate, gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.importDate = { ...where.importDate, lte: new Date(dateTo + 'T23:59:59') };
    }
    if (driverId) {
      where.driverId = parseInt(driverId);
    }
    if (vehicleId) {
      where.vehicleId = parseInt(vehicleId);
    }

    const [imports, total] = await Promise.all([
      prisma.tachographImport.findMany({
        where,
        include: {
          driver: { select: { id: true, fullName: true, cardNumber: true, linkedEmployeeId: true, linkedEmployee: { select: { nombre: true, apellidos: true } } } },
          vehicle: { select: { id: true, plateNumber: true, vin: true, linkedVehicleId: true, linkedVehicle: { select: { matricula: true, marca: true, modelo: true } } } },
          uploadedBy: { select: { id: true, nombre: true } },
          _count: { select: { activities: true, incidents: true } },
        },
        orderBy: { importDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tachographImport.count({ where }),
    ]);

    return NextResponse.json({
      data: imports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    console.error('GET /api/tacografo/imports error:', error);
    return NextResponse.json({ error: 'Error al obtener importaciones' }, { status: 500 });
  }
}
