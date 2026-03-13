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
    const linked = searchParams.get('linked');

    const where: any = { active: true };
    if (linked === 'true') where.linkedVehicleId = { not: null };
    if (linked === 'false') where.linkedVehicleId = null;

    const vehicles = await prisma.tachographVehicle.findMany({
      where,
      include: {
        linkedVehicle: { select: { id: true, matricula: true, marca: true, modelo: true } },
        _count: { select: { imports: true, normalizedEvents: true, incidents: true } },
      },
      orderBy: { plateNumber: 'asc' },
    });

    return NextResponse.json(vehicles);
  } catch (error: any) {
    console.error('GET /api/tacografo/vehicles error:', error);
    return NextResponse.json({ error: 'Error al obtener vehículos' }, { status: 500 });
  }
}
